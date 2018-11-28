"use strict";

const App = require('fib-app');
const util = require("util");
const coroutine = require("coroutine");
const fs = require("fs");

let n = 0;
let caches = {};

let db_dir = process.cwd() + "/queue_cache_dir/";

if (!fs.exists(db_dir)) fs.mkdir(db_dir);

let app = new App("sqlite:" + db_dir + "/queue_cache.db");

app.db.use([(db) => {
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup queues
	 * @apiDescription queues Table字段解释
	 *
	 * @apiParam {Number} id 自增长 id
	 * @apiParam {String} producer_block_id 区块 hash
	 * @apiParam {String} producer 区块生产者
	 * @apiParam {String} status 是否可逆状态 reversible noreversible
	 * @apiParam {String} isExec 是否队列已执行 yes no
	 * @apiParam {JSON} data 一个区块完整信息
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */
	return db.define('queues', {
		id: {
			type: "integer",
			size: 8,
			serial: true,
			key: true
		},
		producer_block_id: {
			unique: true,
			required: true,
			type: "text",
			size: 64
		},
		status: {
			required: true,
			type: "enum",
			values: ["noreversible", "reversible"],
			default: "reversible",
			index: true
		},
		isExec: {
			required: true,
			type: "enum",
			values: ["yes", "no"],
			default: "no",
			index: true
		},
		data: {
			required: true,
			type: "object",
			big: true
		}
	});
}]);

let info = () => {
	return app.db(db => {

		let count = db.models.queues.countSync();

		let unexecCount = db.models.queues.countSync({
			isExec: "no"
		});

		let execCount = count - unexecCount;

		let waitRevers = db.models.queues.countSync({
			isExec: "yes",
			status: "reversible"
		});

		let cacheInfo = {
			count: 0,
			transactions: 0,
			block: 0,
			irreversible_block: 0,
		};

		for (let k in caches) {
			cacheInfo.count = cacheInfo.count + 1;

			let v = caches[k];

			if (v.block) cacheInfo.block = cacheInfo.block + 1;

			if (v.irreversible_block) cacheInfo.irreversible_block = cacheInfo.irreversible_block + 1;

			if (v.transactions.length) cacheInfo.transactions = cacheInfo.transactions + 1;
		}

		return {
			count: count,
			unexecCount: unexecCount,
			execCount: execCount,
			waitRevers: waitRevers,
			cacheInfo: cacheInfo
		}
	});
}

let stats = () => {
	let r = info();
	console.notice(`=============Queue Info=============\ncount:${r.count}\nunexecCount:${r.unexecCount}\nexecCount:${r.execCount}\nwaitRevers:${r.waitRevers}\ncacheInfo:%j\n=============Queue Info=============`, r.cacheInfo)
}

stats();

module.exports = {
	stats: stats,
	put: (eventCaches) => {
		eventCaches.forEach((l) => {
			let event = l.event;
			let d = l.data;

			let k;

			switch (event) {
				case "transaction":
					k = d.producer_block_id;

					caches[k] = caches[k] || {
						transactions: []
					};

					caches[k].transactions.push(d);

					return true;
				case "block":
					k = d.id;

					caches[k] = caches[k] || {
						transactions: []
					};

					caches[k].block = d;

					app.db(db => {
						for (let pid in caches) {

							let v = caches[pid];

							if (!v.block || !v.transactions.length) continue;

							try {
								db.models.queues.createSync({
									producer_block_id: pid,
									status: v.irreversible_block ? "noreversible" : "reversible",
									isExec: "no",
									data: v
								});
							} catch (e) {
								console.error("[Error]Queues block event k:%s stack:", pid, e.stack);
							} finally {
								delete caches[pid];
							}
						}
					});
					return true;
				case "irreversible_block":
					k = d.id;

					return app.db(db => {
						let rs = db.driver.execQuerySync("UPDATE `queues` set status = 'noreversible', updatedAt = ? where producer_block_id = ? and status = 'reversible';", [new Date(), k]);
						if (rs.affected === 1) return true;

						// console.error("[Error]Queues irreversible_block event k:%s affected:%s;", k, rs.affected);

						caches[k] = caches[k] || {
							transactions: []
						};

						caches[k].irreversible_block = true;

						return false;
					});
			}
		});
	},
	take_execs: (cb) => {
		return app.db(db => {
			n++;

			if (n >= 99999999) n = 0;

			if (n % 20 === 0) stats();

			let list = db.models.queues.find({
				isExec: 'no'
			}).order("id").limit(100).runSync().map(d => {
				return d.data;
			});

			if (cb(list)) {
				let ks = list.map((d) => {
					return d.block.id;
				});

				let rs = db.driver.execQuerySync("UPDATE `queues` set isExec = 'yes', updatedAt = ? where producer_block_id in ? and isExec = 'no';", [new Date(), ks]);

				if (rs.affected !== ks.length) {
					console.error("[Error]Queues take_execs ks len:%s affected:%s\nks Data:%j", ks.length, rs.affected, ks);
					return false;
				}

				return true;
			}
		});
	},
	take_revers: (cb) => {
		return app.db(db => {

			let max_id = 0;
			let ks = db.models.queues.find({
				isExec: 'yes',
				status: "noreversible"
			}).order("id").limit(100).runSync().map(d => {

				max_id = Math.max(max_id, d.id);

				return d.producer_block_id;
			});

			if (cb(ks)) {
				db.driver.execQuerySync("DELETE FROM `queues` where id <= ? and isExec = 'yes' and status = 'noreversible';", [max_id]);
				return true;
			}
		});
	},
	stop: () => {
		if (!util.isEmpty(caches)) fs.writeFile(db_dir + new Date().getTime() + "_caches.json", JSON.stringify(caches));
	},
	clear: () => {
		app.db(db => {
			let count = db.models.queues.countSync();

			if (!count) return;

			console.notice('=================Boom=================\n\n');

			console.warn("Are you sure you need to Clear Queues,Exist Count:" + count + "?'");

			if (console.readLine("choose(Y/N):") === "Y") {
				let rs = db.driver.execQuerySync("DELETE FROM `queues`;");
				console.notice("Affected:%s Clear queues DB Success!", rs.affected);
			} else {
				console.notice("Clear queues DB Operation ignored!");
			}

			console.notice("\n\n=================Boom=================");
		});
	}
}