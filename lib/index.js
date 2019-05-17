"use strict";

const App = require('fib-app');
const coroutine = require("coroutine");
const util = require("util");
const fs = require("fs");
const Config = require("./conf/conf.json");

let caches = new util.LruCache(1000);

let deepCopy = (d) => {
	let r = {};

	let _deepCopy = (o, c) => {
		c = c || {}

		for (let i in o) {

			let v = o[i];
			let ty = typeof v;

			if (ty === 'object' && v !== null) {

				c[i] = (v.constructor === Array) ? [] : {};

				_deepCopy(v, c[i]);

			} else {
				c[i] = ty === "bigint" ? v.toString() : v;
			}
		}
		return c;
	}

	_deepCopy(d, r);

	return r;
}

function Tracker() {
	console.notice(`==========fibos-tracker==========\n\nDBconnString: ${Config.DBconnString.replace(/:[^:]*@/, ":*****@")}\n\n==========fibos-tracker==========`);

	let timer;
	let fibos;
	let hookEvents = {};
	let sys_bn;
	let app = new App(Config.DBconnString);

	app.db.use(require('./defs'));

	let checkBlockNum = (block_num) => {

		block_num = Number(block_num);

		if (sys_bn >= block_num) {
			console.warn(util.format("sys block_num(%s) >= node block_num(%s)", sys_bn, block_num));
			return false;
		}

		return true;
	}


	let work = () => {
		console.notice(`\n\n==========fibos-tracker==========\n\ncaches-size:${caches.size}\n\n${new Date()}\n\n==========fibos-tracker==========`);
	};

	this.work = work;

	this.app = app;

	this.use = (model) => {
		if (!model) throw new Error("use:function(model)");

		if (!model.defines || !model.hooks) throw new Error("model define error: Array(defines) JSON(hooks)");

		let defines = model.defines;
		let hooks = model.hooks;

		app.db.use(util.isArray(defines) ? defines : [defines]);

		for (let f in hooks) {
			hookEvents[f] = hookEvents[f] || [];
			hookEvents[f].push(hooks[f]);
		}
	};

	this.emitter = (fb) => {
		if (!fb) throw new Error("emitter params: fibos!");

		sys_bn = app.db(db => {
			return db.models.blocks.get_sys_last();
		});

		fibos = fb;

		fibos.load("emitter");

		fibos.on({
			transaction: (trx) => {
				let block_num = trx.block_num.toString();
				let producer_block_id = trx.producer_block_id;

				if (!producer_block_id) return;

				if (!checkBlockNum(block_num)) return;

				if (!trx.action_traces) {
					console.warn("Invalid Transaction:", trx);
					return;
				}
				trx = deepCopy(trx);
				if (!trx.action_traces.length) return;

				if (trx.action_traces[0].act.name === "onblock" && trx.action_traces[0].act.account === "eosio") return;

				app.db(db => {
					db.models["transactions"].createSync({
						trx_id: trx.id,
						producer_block_id: trx.producer_block_id,
						rawData: trx
					});

				});
			},
			block: (bk) => {
				let block_num = bk.block_num.toString();

				if (!checkBlockNum(block_num)) return;

				if (!bk.block) {
					console.warn("Invalid Block!");
					return;
				}
				bk = deepCopy(bk);
				let messages = {};
				let collectMessage = (_at) => {
					function _c(f) {
						if (hookEvents[f]) {
							messages[f] = messages[f] || [];
							messages[f].push(_at);
						}
					}

					_c(_at.act.account);

					_c(_at.act.account + "/" + _at.act.name);
				}
				app.db(db => {
					db.trans(() => {
						if (db.models.blocks.get(bk.id)) {
							console.warn("Reentrant block id:", bk.id);
							return;
						}
						db.models["blocks"].createSync({
							block_num: bk.block_num,
							block_time: bk.block.timestamp,
							producer: bk.block.producer,
							producer_block_id: bk.id,
							previous: bk.block.previous, //前一块
							status: "reversible"
						});

						let now_block = {
							producer_block_id: bk.id,
							previous: bk.block.previous, //前一块
							next: "", //下一块
							block_num: bk.block_num,
							producer: bk.block.producer,
							status: "reversible"
						};

						caches.set(bk.id, now_block);

						let arr = [];
						try {
							while (arr.length < 14 && now_block) {

								arr.push(now_block);

								now_block = caches.get(now_block.previous, (k) => db.models["blocks"].oneSync({
									producer_block_id: k
								}));
							}
						} catch (e) {
							// console.error('now_block', e)
						}
						if (arr.length < 13) {
							return;
						}
						if (arr.length == 14) {
							if (arr[13].status != "lightconfirm") throw new Error("13 status != lightconfirm" + arr[13].status);
							if (arr[13].producer != arr[12].producer) {
								if (arr[12].status == "lightconfirm") throw new Error("12 status != lightconfirm" + arr[12].status);
							} else {
								if (arr[12].status == "lightconfirm") return;
							}
						}
						const producer = arr[12].producer;
						for (let i = 12; i > 0; i--) {
							if (arr[i].producer == producer) {
								arr[i].status = "lightconfirm";
								let blocks = db.models["blocks"].oneSync({
									producer_block_id: arr[i].producer_block_id
								})
								blocks.saveSync({
									status: "lightconfirm"
								});

								let trxs = db.models.transactions.findSync({
									producer_block_id: arr[i].producer_block_id
								});

								trxs.forEach((trx) => {
									trx = trx.rawData;

									function execActions(at, parent) {

										if (parent) {
											let _parent = deepCopy(parent);
											delete _parent.inline_traces;
											at.parent = _parent;
										}

										collectMessage(at);

										at.inline_traces.forEach((_at) => {
											execActions(_at, at);
										});
									}

									trx.action_traces.forEach((msg) => {
										execActions(msg);
									});
								});
							} else {
								break;
							}
						}
					});

					for (let f in messages) {
						let ats = messages[f];
						let hooks = hookEvents[f];
						if (hooks) hooks.forEach((hook) => {
							try {
								hook(db, ats)
							} catch (e) {
								console.error("[%s]", f, ats, e.stack);
							}
						});
					}
				});
			}
		});

		timer = setInterval(work, 5 * 1000);
	}

	this.diagram = () => fs.writeTextFile(process.cwd() + '/diagram.svg', app.diagram());

	this.stop = () => {
		if (fibos) fibos.stop();
		timer.clear();
		process.exit();
	}
}

Tracker.Config = Config;

module.exports = Tracker;