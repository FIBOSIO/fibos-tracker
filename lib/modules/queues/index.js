const App = require('fib-app');
const coroutine = require("coroutine");
const fs = require("fs");

let n = 0;
let queues = {};

let db_dir = process.cwd() + "/queue_cache_dir/";

if (!fs.exists(db_dir)) fs.mkdir(db_dir);

let app = new App("sqlite:" + db_dir + "/queue_cache.db");

app.db.use([(db) => {
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

let hello = () => {
	let r = info();
	console.notice(`=============Queue Info=============\ncount:${r.count}\nunexecCount:${r.unexecCount}\nexecCount:${r.execCount}\nwaitRevers:${r.waitRevers}\n=============Queue Info=============\n`)
}

hello();

module.exports = {
	hello: hello,
	clear: () => {
		app.db(db => {
			db.driver.execQuerySync("DELETE FROM `queues`;");
		});
	},
	take_execs: () => {
		return app.db(db => {
			n++;

			if (n % 15 === 0) hello();

			return db.models.queues.find({
				isExec: 'no'
			}).order("id").limit(100).runSync().map(d => {
				return d.data;
			});
		});
	},
	take_revers: () => {
		return app.db(db => {
			return db.models.queues.find({
				isExec: 'yes',
				status: "noreversible"
			}).order("id").limit(100).runSync().map(d => {
				return d.producer_block_id;
			});
		});
	},
	put_transactions: (k, d) => {
		queues[k] = queues[k] || {
			transactions: []
		};

		queues[k].transactions.push(d);
	},
	put_block: (k, d) => {
		if (!queues[k]) coroutine.sleep(100);

		queues[k].block = d;

		app.db(db => {
			db.models.queues.createSync({
				producer_block_id: k,
				status: "reversible",
				isExec: "no",
				data: queues[k]
			});
		});

		delete queues[k];
	},
	revers: (k) => {
		return app.db(db => {
			let r;
			let retry = 2;
			while (retry) {
				retry--;
				r = db.driver.execQuerySync("UPDATE `queues` set status = 'noreversible', updatedAt = ? where producer_block_id = ? and status = 'reversible';", [new Date(), k]).affected === 1;
				if (r) return true;

				coroutine.sleep(100);
			}
			if (!r) {
				console.error("[Error]queues revers k:%s affected != 1;", k);
				return false;
			}
			return true;
		});
	},
	exec: (ks) => {
		return app.db(db => {
			let rs = db.driver.execQuerySync("UPDATE `queues` set isExec = 'yes', updatedAt = ? where producer_block_id in ? and isExec = 'no';", [new Date(), ks]);

			if (rs.affected !== ks.length) {
				console.error("[Error]queues exec ks len:%s affected:%s\nks Data:%j", ks.length, rs.affected, ks);
				return false;
			}

			return true;
		});
	},
	remove: (ks) => {
		return app.db(db => {
			let rs = db.driver.execQuerySync("DELETE FROM `queues` where producer_block_id in ? and isExec = 'yes' and status = 'noreversible';", [ks]);

			if (rs.affected !== ks.length) {
				console.error('[Error]queues remove ks len:%s affected: %s\nks Data:%j', ks.length, rs.affected, ks);
				return false;
			}

			return true;
		});
	}
}