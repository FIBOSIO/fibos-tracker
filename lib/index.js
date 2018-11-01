const App = require('fib-app');
const coroutine = require("coroutine");
const util = require("util");
const path = require("path");
const fs = require("fs");
const FIBOS = require("fibos.js");
const Config = require("./conf/conf.json");

function bigIntoString(d) {
	for (let k in d) {

		let v = d[k];
		let type = typeof v;

		if (type === "bigint") d[k] = v.toString();

		if (type === "object") bigIntoString(v);
	}
}

function Tracker() {
	let hookList = {},
		app = new App(Config.DBconnString);

	app.db.use(require('./defs'));

	let sys_last_irreversible_block_num;

	let httpEndpoint = "http://127.0.0.1:" + Config.emitterNodePort;

	let client = FIBOS({
		httpEndpoint: httpEndpoint,
		logger: {
			log: null,
			error: null
		}
	});

	console.notice(`==========fibos-tracker==========\n\nDBconnString: ${Config.DBconnString}\n\nemitterNode: ${httpEndpoint}\n\n==========fibos-tracker==========`);

	setInterval(() => {
		try {
			let bn = client.getInfoSync().last_irreversible_block_num;

			let r = app.db(db => {
				return db.models.blocks.updateStatus(bn);
			});

			console.notice("update blocks irreversible block:", r);
		} catch (e) {
			console.error("Chain Node:%s can not Connect!", httpEndpoint);
			console.error("Chain Error:", e);
		}
	}, 5 * 1000);

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

	this.emitter = (errCallback) => {

		return (message) => {
			sys_last_irreversible_block_num = sys_last_irreversible_block_num || app.db(db => {
				return db.models.blocks.get_sys_last();
			});

			if (!message || !message.producer_block_id) return;

			if (message.act.name === "onblock" && !Config.onblockEnable) return;

			console.time("emitter-time");

			bigIntoString(message);

			if (sys_last_irreversible_block_num > message.block_num) {
				let s = util.format("sys block_num(%s) > node block_num(%s)", sys_last_irreversible_block_num, message.block_num);
				console.error(s);
				if (util.isFunction(errCallback)) errCallback(message, s);
				return;
			}

			app.db(db => {
				try {
					let messages = {};
					let sys_blocksTable = db.models.blocks;
					let sys_actionsTable = db.models.actions;

					function collectMessage(_action) {
						function _c(f) {
							if (hookList[f]) {
								messages[f] = messages[f] || [];
								messages[f].push(_action);
							}
						}

						_c(_action.contract_name);

						_c(_action.contract_name + "/" + _action.action);
					}

					db.trans(() => {

						let _block = sys_blocksTable.save({
							block_num: message.block_num,
							block_time: message.block_time,
							producer: message.producer,
							producer_block_id: message.producer_block_id
						});

						function execActions(at, parentid) {

							let _action = sys_actionsTable.createSync({
								block_id: !parentid ? _block.id : null,
								parent_id: parentid || null,
								trx_id: at.trx_id,
								contract_name: at.act.account,
								action: at.act.name,
								authorization: at.act.authorization.map((a) => {
									return a.actor + "@" + a.permission
								}),
								data: at.act.data,
								rawData: !parentid ? at : {}
							});

							collectMessage(_action);

							at.inline_traces.forEach((_at) => {
								execActions(_at, _action.id);
							});
						}

						execActions(message);
					});

					for (var f in messages) {
						var ats = messages[f];
						var hooks = hookList[f];
						if (hooks) hooks.forEach((hook) => hook(db, ats));
					}

				} catch (e) {
					console.error("emitter Error:", message, e, e.stack);

					if (util.isFunction(errCallback)) errCallback(message, e);
				}
			});

			console.timeEnd("emitter-time");
		};
	}

	this.diagram = () => fs.writeTextFile(process.cwd() + '/diagram.svg', app.diagram());
}

Tracker.Config = Config;

module.exports = Tracker;