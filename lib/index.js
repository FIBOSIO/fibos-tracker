"use strict";

const App = require('fib-app');
const util = require("util");
const fs = require("fs");
const Config = require("./conf/conf.json");

let block_caches = new util.LruCache(2000);

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

	let fibos;
	let hookEvents = {};
	let sys_bn, nore_bn;
	let app = new App(Config.DBconnString);

	app.db.use(require('./defs'));

	let checkBlockNum = (block_num, type) => {

		block_num = Number(block_num);
		let check_num = sys_bn;
		if (type && type == "noreversible") check_num = nore_bn;
		if (check_num >= block_num) {
			console.warn("sys block_num(%s) >= node block_num(%s)", check_num, block_num);
			return false;
		}

		return true;
	}

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

	function dealData(db, msg, event) {
		let messages = {};
		event = event ? event + ":" : "";
		let collectMessage = (_at) => {
			function _c(f) {
				if (hookEvents[f]) {
					messages[f] = messages[f] || [];
					messages[f].push(_at);
				}
			}

			_c(event + _at.act.account);

			_c(event + _at.act.account + "/" + _at.act.name);
		}

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

		execActions(msg);

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
	}

	this.emitter = (fb) => {
		if (!fb) throw new Error("emitter params: fibos!");

		sys_bn = app.db(db => {
			return db.models.blocks.get_sys_last();
		});
		nore_bn = app.db(db => {
			return db.models.blocks.get_nore_last();
		})
		if (Config.replay) {
			let replayStatrBn = Config.replayStatrBn || 0;
			while (replayStatrBn < sys_bn) {
				app.db(db => {
					console.time(`[replay block on:${replayStatrBn} ] use`);
					let blocks = db.driver.execQuerySync(`select block_num,status,producer_block_id from blocks where block_num>? order by block_num limit 1000`, [replayStatrBn]);
					db.trans(() => {
						blocks.forEach(bk => {
							let trxs = db.driver.execQuerySync(`select * from transactions where producer_block_id = ?`, [bk.producer_block_id]);
							if (!trxs.length) return;

							trxs.forEach((trx) => {
								JSON.parse(trx.rawData.toString()).action_traces.forEach((msg) => { dealData(db, msg, "reversible"); });
							});

							if (["lightconfirm", "noreversible"].includes(bk.status)) {
								trxs.forEach((trx) => {
									JSON.parse(trx.rawData.toString()).action_traces.forEach((msg) => { dealData(db, msg); });
								});
							}

							if (bk.status == "noreversible") {
								trxs.forEach((trx) => {
									JSON.parse(trx.rawData.toString()).action_traces.forEach((msg) => { dealData(db, msg, "noreversible"); });
								});
							}
						})
					})
					console.timeEnd(`[replay block on:${replayStatrBn} ] use`);
					replayStatrBn = blocks[blocks.length - 1].block_num;
				})
			}
		}

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
					let Transactions = db.models.transactions;
					let t = Transactions.oneSync({
						trx_id: trx.id,
						producer_block_id: trx.producer_block_id,
					})
					if (t) return;
					db.models["transactions"].createSync({
						trx_id: trx.id,
						producer_block_id: trx.producer_block_id,
						rawData: trx
					});
				});
				block_caches.get(producer_block_id, id => { transactions: [] }).transactions.push({ rawData: trx });
			},
			block: (bk) => {
				let block_num = bk.block_num.toString();

				if (!checkBlockNum(block_num)) return;

				if (!bk.block) {
					console.warn("Invalid Block!");
					return;
				}
				bk = deepCopy(bk);
				let _trxs = block_caches.get(bk.id);

				let now_block = {
					producer_block_id: bk.id,
					previous: bk.block.previous, //前一块
					block_num: bk.block_num,
					producer: bk.block.producer,
					block_time: bk.block.timestamp,
					transactions: !!_trxs ? _trxs.transactions : [],
					status: "reversible"
				};
				let c_block = now_block;

				block_caches.set(now_block.producer_block_id, now_block);
				app.db(db => {
					let arr = [];
					while (arr.length < 14 && now_block) {
						arr.push(now_block);
						let previous = now_block.previous;
						now_block = block_caches.get(previous, (previous) => {
							let block = db.models.blocks.oneSync({
								producer_block_id: previous
							});
							if (!block) {
								block = JSON.parse(fb.post('/v1/chain/get_block', JSON.stringify({ block_num_or_id: previous })));
								block = {
									producer_block_id: block.id,
									previous: block.previous,
									block_num: block.block_num,
									producer: block.producer,
									block_time: block.timestamp,
									status: "reversible"
								}
							}

							if (!block.block_num) return null;
							let _transactions = db.models.transactions.find({ producer_block_id: block.producer_block_id }).order("id").runSync();
							return {
								producer_block_id: block.producer_block_id,
								previous: block.previous,
								block_num: block.block_num,
								producer: block.producer,
								block_time: block.block_time,
								transactions: _transactions,
								status: arr.length == '13' ? 'lightconfirm' : block.status
							}
						});
					}
					let deal_block = [];
					if (arr.length > 12) {
						let producer = arr[12].producer;
						let confirm = () => {
							for (let i = 12; i > 0; i--) {
								if (arr[i].producer == producer) {
									if (arr[i].status == 'reversible') arr[i].status = "lightconfirm";
									let _block = block_caches.get(arr[i].producer_block_id);
									if (_block && _block.transactions && _block.transactions.length) deal_block.push(_block);
								} else {
									break;
								}
							}
						}
						if (arr.length == 14) {
							if (!["lightconfirm", "noreversible"].includes(arr[13].status)) throw new Error("13 status != lightconfirm&noreversible" + arr[13].status);
							if (arr[12].status == "reversible") confirm();
						} else {
							confirm();
						}
					}

					db.trans(() => {
						if (c_block.transactions.length) {
							if (db.models.blocks.get(bk.producer_block_id)) {
								console.warn("Reentrant block id:", bk.producer_block_id);
								return;
							}

							db.models["blocks"].createSync({
								block_num: c_block.block_num,
								block_time: c_block.block_time,
								producer: c_block.producer,
								producer_block_id: c_block.producer_block_id,
								previous: c_block.previous,
								status: "reversible"
							});

							c_block.transactions.forEach((trx) => { trx.rawData.action_traces.forEach((msg) => { dealData(db, msg, 'reversible'); }) })
						}

						if (deal_block.length) {
							deal_block.forEach(bk => {
								if (bk.status != 'lightconfirm') return;
								db.driver.execQuerySync(`update blocks set status = 'lightconfirm' where producer_block_id = ?`, [bk.producer_block_id]);
								bk.transactions.forEach((trx) => { trx.rawData.action_traces.forEach((msg) => { dealData(db, msg); }); });
							});
						}
					});
				});
			},
			irreversible_block: (blk) => {
				let block_num = blk.block_num.toString();
				if (!checkBlockNum(block_num, 'noreversible')) return;

				let producer_block_id = blk.id;
				app.db(db => {
					let block = block_caches.get(producer_block_id, (producer_block_id) => {
						let _block = db.models.blocks.oneSync({
							producer_block_id: producer_block_id
						});
						if (!_block) return null;
						let _transactions = db.models.transactions.find({ producer_block_id: producer_block_id }).order("id").runSync();
						return {
							producer_block_id: _block.producer_block_id,
							previous: _block.previous,
							block_num: _block.block_num,
							producer: _block.producer,
							block_time: _block.block_time,
							transactions: _transactions,
							status: _block.status
						}
					});

					if (!block || !block.transactions || !block.transactions.length) return;
					db.trans(() => {
						if (block.status === 'reversible') {
							block.transactions.forEach(trx => { trx.rawData.action_traces.forEach(msg => { dealData(db, msg) }); })
						}
						block.status = "noreversible";
						block.transactions.forEach(trx => { trx.rawData.action_traces.forEach(msg => { dealData(db, msg, 'noreversible') }); })
						db.driver.execQuerySync(`update blocks set status = 'noreversible' where producer_block_id = ?`, [producer_block_id]);
					})
				})
			}
		});
	}

	this.diagram = () => fs.writeTextFile(process.cwd() + '/diagram.svg', app.diagram());

	this.stop = () => {
		if (fibos) fibos.stop();
		process.exit();
	}
}

Tracker.Config = Config;

module.exports = Tracker;