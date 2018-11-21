const App = require('fib-app');
const coroutine = require("coroutine");
const util = require("util");
const path = require("path");
const fs = require("fs");
const FIBOS = require("fibos.js");
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

	let hookList = {};
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

	let emitterEvents = {
		transaction: (message) => {
			let block_num = message.block_num.toString();
			let trx_id = message.id;

			if (!message.producer_block_id) return;

			if (!checkBlockNum(block_num)) return;

			if (!message.action_traces) {
				console.warn("Invalid Transaction!");
				return;
			}

			if (!message.action_traces.length) return;

			if (message.action_traces[0].act.name === "onblock" && message.action_traces[0].act.account === "eosio" && Config.isFilterInvalidBlock) return;

			app.db(db => {
				try {
					let messages = {};
					let sys_actionsTable = db.models.actions;

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

						function execActions(at, parent) {
							if (parent) {
								let _parent = deepCopy(parent, true);
								delete _parent.inline_traces;
								at.parent = _parent;
							}

							sys_actionsTable.createSync(deepCopy({
								id: at.receipt.global_sequence,
								block_id: !parent ? block_num : undefined,
								parent_id: parent ? parent.receipt.global_sequence : undefined,
								trx_id: trx_id,
								contract_name: at.act.account,
								action: at.act.name,
								authorization: at.act.authorization.map((a) => {
									return a.actor + "@" + a.permission
								}),
								data: at.act.data,
								rawData: !parent ? at : {}
							}));

							collectMessage(at);

							at.inline_traces.forEach((_at) => {
								execActions(_at, at);
							});
						}

						message.action_traces.forEach((msg) => {
							execActions(msg);
						});
					});

					for (var f in messages) {
						var ats = messages[f];
						var hooks = hookList[f];
						if (hooks) hooks.forEach((hook) => hook(db, ats));
					}
				} catch (e) {
					console.error("transaction Error:", message, e, e.stack);
				}
			});
		},
		block: (message) => {
			let block_num = message.block_num.toString();

			if (!checkBlockNum(block_num)) return;

			if (!message.block) {
				console.warn("Invalid Block!");
				return;
			}

			if (!message.block.transactions.length && Config.isFilterInvalidBlock) return;

			app.db(db => {
				try {
					db.models.blocks.createSync({
						id: block_num,
						timestamp: message.block.timestamp,
						producer: message.block.producer,
						producer_block_id: message.id,
						status: "reversible"
					}).id;
				} catch (e) {
					console.error("block Error:", message, e, e.stack);
				}
			});
		},
		irreversible_block: (message) => {
			let block_num = message.block_num.toString();

			if (!checkBlockNum(block_num)) return;

			if (!message.block) {
				console.warn("Invalid Block!");
				return;
			}

			if (!message.block.transactions.length && Config.isFilterInvalidBlock) return;

			if (!message.validated) return;

			app.db(db => {
				db.models.blocks.updateStatus(block_num);
			});
		}
	}

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

	this.emitter = (fibos) => {
		if (!fibos) throw new Error("emitter params: fibos!");

		fibos.load("emitter");

		for (var eventName in emitterEvents)
			fibos.on(eventName, emitterEvents[eventName]);
	}

	this.diagram = () => fs.writeTextFile(process.cwd() + '/diagram.svg', app.diagram());
}

Tracker.Config = Config;

module.exports = Tracker;