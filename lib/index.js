"use strict";

const App = require('fib-app');
const coroutine = require("coroutine");
const util = require("util");
const fs = require("fs");
const Queues = require("./modules/queues");
const Config = require("./conf/conf.json");

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
	console.notice(`==========fibos-tracker==========\n\nDBconnString: ${Config.DBconnString.replace(/:[^:]*@/, ":*****@")}\n\nisFilterNullBlock: ${Config.isFilterNullBlock}\n\nisSyncSystemBlock:${Config.isSyncSystemBlock}\n\n==========fibos-tracker==========`);

	let timer;
	let fibos;
	let eventCaches = [];
	let hookEvents = {};
	let timerRuned = false;
	let sys_bn;
	let app = new App(Config.DBconnString);

	app.db.use(require('./defs'));

	let checkBlockNum = (block_num) => {

		block_num = Number(block_num);

		sys_bn = sys_bn || app.db(db => {
			return db.models.blocks.get_sys_last();
		});

		if (sys_bn >= block_num) {
			console.warn(util.format("sys block_num(%s) >= node block_num(%s)", sys_bn, block_num));
			return false;
		}

		return true;
	}

	let work = () => {
		Queues.put(eventCaches);

		eventCaches = [];

		if (timerRuned) return;

		timerRuned = true;

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

		try {
			app.db(db => {

				Queues.take_execs((queues) => {
					if (!queues.length) return false;

					try {
						db.trans(() => {

							let createSync = (model, d) => {
								if (!Config.isSyncSystemBlock) return {};

								return db.models[model].createSync(d);
							}

							queues.forEach((queue) => {
								let trxs = queue.transactions;
								let bk = queue.block;

								if (db.models.blocks.get(bk.id)) {
									console.warn("Reentrant block id:", bk.id);
									return;
								}

								let block_id = createSync('blocks', {
									block_num: bk.block_num,
									block_time: bk.block.timestamp,
									producer: bk.block.producer,
									producer_block_id: bk.id,
									status: "reversible"
								}).id;

								trxs.forEach((trx) => {
									let transaction_id = createSync('transactions', {
										trx_id: trx.id,
										block_id: block_id,
										rawData: trx
									}).id;

									function execActions(at, parent) {
										let parent_id;

										if (parent) {
											let _parent = deepCopy(parent);
											delete _parent.inline_traces;
											at.parent = _parent;
										}

										parent_id = createSync('actions', {
											transaction_id: !parent ? transaction_id : undefined,
											parent_id: parent ? parent.parent_id : undefined,
											contract_name: at.act.account,
											action_name: at.act.name,
											authorization: at.act.authorization.map((a) => {
												return a.actor + "@" + a.permission
											}),
											data: (typeof at.act.data === "object") ? at.act.data : {
												data: at.act.data
											}
										}).id;

										collectMessage(at);

										at.parent_id = parent_id;

										at.inline_traces.forEach((_at) => {
											execActions(_at, at);
										});
									}

									trx.action_traces.forEach((msg) => {
										execActions(msg);
									});
								});
							});
						});

						return true;
					} catch (e) {
						console.error("Abnormal Exit queues:", queues);
						throw e;
					}
				});

				Queues.take_revers((reverids) => {
					if (!reverids.length) return false;

					if (Config.isSyncSystemBlock && !db.models.blocks.updateStatus(reverids))
						throw new Error("update reverids error!");

					return true;
				});

				for (var f in messages) {
					var ats = messages[f];
					var hooks = hookEvents[f];
					if (hooks) hooks.forEach((hook) => {
						try {
							hook(db, ats)
						} catch (e) {
							console.error("[%s]", f, ats, e.stack);
						}
					});
				}
			});
		} catch (e) {
			console.error(e.stack);

			if (fibos) fibos.stop();

			process.exit();
		} finally {
			timerRuned = false;
		}
	};

	this.Queues = Queues;

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

				if (!trx.action_traces.length) return;

				if (trx.action_traces[0].act.name === "onblock" && trx.action_traces[0].act.account === "eosio") return;

				eventCaches.push({
					event: "transaction",
					data: deepCopy(trx)
				});
			},
			block: (bk) => {
				let block_num = bk.block_num.toString();

				if (!checkBlockNum(block_num)) return;

				if (!bk.block) {
					console.warn("Invalid Block!");
					return;
				}

				if (!bk.block.transactions.length && Config.isFilterNullBlock) return;

				eventCaches.push({
					event: "block",
					data: deepCopy(bk)
				});
			},
			irreversible_block: (bk) => {
				let block_num = bk.block_num.toString();

				if (!checkBlockNum(block_num)) return;

				if (!bk.block) {
					console.warn("Invalid Block!");
					return;
				}

				if (!bk.block.transactions.length && Config.isFilterNullBlock) return;

				if (!bk.validated) return;

				eventCaches.push({
					event: "irreversible_block",
					data: deepCopy(bk)
				});
			}
		});

		timer = setInterval(work, 500);
	}

	this.diagram = () => fs.writeTextFile(process.cwd() + '/diagram.svg', app.diagram());

	this.stop = () => {
		let retry = 0;

		if (fibos) fibos.stop();

		Queues.stats();

		while (timerRuned) {
			retry++;

			Queues.stats();

			coroutine.sleep(2000);

			if (retry >= 5) break;
		}

		timer.clear();

		Queues.put(eventCaches);

		eventCaches = [];

		Queues.stop();

		process.exit();
	}
}

Tracker.Config = Config;

module.exports = Tracker;