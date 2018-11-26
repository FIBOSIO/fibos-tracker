const http = require("http");
const coroutine = require("coroutine");
const Tracker = require("../");
const mock_db = require("./mock_db.json");

Tracker.Config.DBconnString = "mysql://root:123456@127.0.0.1/fibos_chain";
Tracker.Config.isSyncSystemBlock = true;

const tracker = new Tracker();

tracker.diagram();

tracker.queues.clear();

tracker.queues.put_transactions(mock_db.transaction.producer_block_id, mock_db.transaction);

tracker.queues.put_block(mock_db.block.id, mock_db.block);

tracker.queues.revers(mock_db.irreversible_block.id, mock_db.irreversible_block);

tracker.work();

tracker.queues.hello();

let httpServer = new http.Server("", 8080, [
	(req) => {
		req.session = {};
	}, {
		'^/ping': (req) => {
			req.response.write("pong");
		},
		'/1.0/app': tracker.app,
		"*": [function(req) {}]
	},
	function(req) {}
]);

httpServer.crossDomain = true;
httpServer.asyncRun();