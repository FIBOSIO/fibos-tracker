"use strict";

const App = require('fib-app');
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

		return {
			count: count,
			unexecCount: unexecCount,
			execCount: execCount,
			waitRevers: waitRevers
		}
	});
}

let stats = () => {
	let r = info();
	console.notice(`=============Queue Info=============\ncount:${r.count}\nunexecCount:${r.unexecCount}\nexecCount:${r.execCount}\nwaitRevers:${r.waitRevers}\n=============Queue Info=============\n`)
}

stats();

module.exports = {
	stats: stats,
	put: (event, d) => {
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

				caches[k].block = d;

				app.db(db => {
					db.models.queues.createSync({
						producer_block_id: k,
						status: "reversible",
						isExec: "no",
						data: caches[k]
					});
				});

				delete caches[k];

				return true;
			case "irreversible_block":
				k = d.id;

				return app.db(db => {
					let r = db.driver.execQuerySync("UPDATE `queues` set status = 'noreversible', updatedAt = ? where producer_block_id = ? and status = 'reversible';", [new Date(), k]).affected === 1;
					if (r) return true;

					console.error("[Error]queues put_revers k:%s affected != 1;", k);
					return false;
				});
		}
	},
	take_execs: (cb) => {
		return app.db(db => {
			n++;

			if (n >= 99999999) n = 0;

			if (n % 5 === 0) stats();

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
					console.error("[Error]queues exec ks len:%s affected:%s\nks Data:%j", ks.length, rs.affected, ks);
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
				db.driver.execQuerySync("DELETE FROM `queues` where id <= ? and isExec = 'yes';", [max_id]);
				return true;
			}
		});
	},
	clear: () => {
		app.db(db => {
			let count = db.models.queues.countSync();

			if (!count) return;

			console.notice('=================Boom=================\n\n');

			console.warn("Are you sure you need to Clear Queues,Exist Count:" + count + "?'");

			if (console.readLine("choose(Y/N):") === "Y") {
				db.driver.execQuerySync("DELETE FROM `queues`;");
				console.notice("Clear queues DB Success!");
			} else {
				console.notice("Clear queues DB Operation ignored!");
			}

			console.notice("\n\n=================Boom=================");
		});
	}
}