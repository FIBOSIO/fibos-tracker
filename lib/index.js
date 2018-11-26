const App = require('fib-app');
const coroutine = require("coroutine");
const util = require("util");
const path = require("path");
const fs = require("fs");
const Queues = require("./queues.js");
const Config = require("./conf/conf.json");

global.deepCopy = function(d, notConvert) {
	let r = {};

	function _deepCopy(o, c) {
		c = c || {}

		for (let i in o) {

			let v = o[i];
			let ty = typeof v;

			if (ty === 'object' && v !== null) {

				c[i] = (v.constructor === Array) ? [] : {};

				_deepCopy(v, c[i]);

			} else {
				c[i] = (ty === "bigint" && !notConvert) ? v.toString() : v;
			}
		}
		return c;
	}

	_deepCopy(d, r);

	return r;
}

function Tracker() {
	console.notice(`==========fibos-tracker==========\n\nDBconnString: ${Config.DBconnString}\n\isFilterInvalidBlock: ${Config.isFilterInvalidBlock}\n\n==========fibos-tracker==========`);

	let timer;
	let fibos;
	let hookList = {};
	let irreversibles = [];
	let queues = new Queues();
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
			console.error(util.format("sys block_num(%s) >= node block_num(%s)", sys_bn, block_num));
			return false;
		}

		return true;
	}

	this.queues = queues;

	this.app = app;

	this.use = (model) => {
		if (!model) throw new Error("use:function(model)");

		if (!model.defines || !model.hooks) throw new Error("model define error: Array(defines) JSON(hooks)");

		let defines = model.defines;
		let hooks = model.hooks;

		app.db.use(util.isArray(defines) ? defines : [defines]);

		for (let f in hooks) {
			hookList[f] = hookList[f] || [];
			hookList[f].push(hooks[f]);
		}
	};

	this.emitter = (fb) => {
		if (!fb) throw new Error("emitter params: fibos!");

		fibos = fb;

		fibos.load("emitter");

		let emitterEvents = {
			transaction: (trx) => {
				let block_num = trx.block_num.toString();
				let producer_block_id = trx.producer_block_id;

				if (!producer_block_id) return;

				if (!checkBlockNum(block_num)) return;

				if (!trx.action_traces) {
					console.warn("Invalid Transaction!");
					return;
				}

				if (!trx.action_traces.length) return;

				if (trx.action_traces[0].act.name === "onblock" && trx.action_traces[0].act.account === "eosio" && Config.isFilterInvalidBlock) return;

				queues.put_transactions(producer_block_id, trx);

			},
			block: (bk) => {
				let block_num = bk.block_num.toString();

				if (!checkBlockNum(block_num)) return;

				if (!bk.block) {
					console.warn("Invalid Block!");
					return;
				}

				if (!bk.block.transactions.length && Config.isFilterInvalidBlock) return;

				queues.put_block(bk.id, bk);

			},
			irreversible_block: (bk) => {
				let block_num = bk.block_num.toString();

				if (!checkBlockNum(block_num)) return;

				if (!bk.block) {
					console.warn("Invalid Block!");
					return;
				}

				if (!bk.block.transactions.length && Config.isFilterInvalidBlock) return;

				if (!bk.validated) return;

				irreversibles.push(bk.id);
			}
		}

		for (var eventName in emitterEvents)
			fibos.on(eventName, emitterEvents[eventName]);

		timer = setInterval(() => {
			if (timerRuned) return;

			let info = queues.takes();
			let queuesList = info.confirmed.slice(0, 500);

			if (!queuesList.length) return;


			timerRuned = true;

			try {
				app.db(db => {
					let messages = {};

					function collectMessage(_at) {
						function _c(f) {
							if (hookList[f]) {
								messages[f] = messages[f] || [];
								messages[f].push(_at);
							}
						}

						_c(_at.act.account);

						_c(_at.act.account + "/" + _at.act.name);
					}


					db.trans(() => {

						let saved = 0;

						queuesList.forEach((queue) => {
							let trxs = queue.transactions;
							let bk = queue.block;

							let createSync = (model, d) => {
								if (!Config.enableSystemData) return {};

								return db.models[model].createSync(d);
							}

							if (db.models.blocks.get(bk.id)) {
								console.warn("Reentrant block id:", bk.id);
								queues.remove(bk.id);
								return;
							}

							let block_id = createSync('blocks', {
								block_num: bk.block_num.toString(),
								block_time: bk.block.timestamp,
								producer: bk.block.producer,
								producer_block_id: bk.id,
								status: "reversible"
							}).id;

							trxs.forEach((trx) => {
								let transaction_id = createSync('transactions', {
									trx_id: trx.id,
									block_id: block_id,
									rawData: deepCopy(trx)
								}).id;

								function execActions(at, parent) {
									let parent_id;

									if (parent) {
										let _parent = deepCopy(parent, true);
										delete _parent.inline_traces;
										at.parent = _parent;
									}

									parent_id = createSync('actions', deepCopy({
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
									})).id;

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

							queues.remove(bk.id);

							saved++;
						});

						if (Config.enableSystemData) {

							console.notice("len:%s unconfirmed:%s confirmed:%s saved:%s", info.len, info.unconfirmed.length, info.confirmed.length, saved);

							if (irreversibles.length) {
								let _irreversibles = util.clone(irreversibles);
								irreversibles = [];
								let affected = db.models.blocks.updateStatus(_irreversibles);
								console.notice("update irreversibles %s affected %s", _irreversibles.length, affected);
							}
						}
					});

					for (var f in messages) {
						var ats = messages[f];
						var hooks = hookList[f];
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
				console.error("Abnormal Exit queuesList:", queuesList);

				console.error("Abnormal Exit Error:", e, e.stack);

				fibos.stop();
				process.exit();
			} finally {
				timerRuned = false;
			}

		}, 2000);
	}

	this.diagram = () => fs.writeTextFile(process.cwd() + '/diagram.svg', app.diagram());

	this.stop = () => {
		let retry = 0;

		if (!fibos) return;

		fibos.stop();

		let info = queues.takes();
		console.notice("[Stopping-%s]len:%s unconfirmed:%s confirmed:%s", retry, info.len, info.unconfirmed.length, info.confirmed.length);

		while (timerRuned) {
			retry++;

			info = queues.takes();

			console.notice("[Stopping-%s]len:%s unconfirmed:%s confirmed:%s", retry, info.len, info.unconfirmed.length, info.confirmed.length);

			if (!info.len) break;

			coroutine.sleep(2000);

			if (retry >= 5) break;
		}

		timer.clear();

		process.exit();
	}
}

Tracker.Config = Config;

module.exports = Tracker;