// [clean env]

const fs = require("fs");
["", "\-shm", "\-wal"].forEach(function(k) {
	if (fs.exists("./fibos_chain.db" + k)) fs.unlink("./fibos_chain.db" + k);
});

let setLogs = (logPath) => {
	if (!fs.exists(logPath)) fs.mkdir(logPath);

	console.add([{
		type: "console",
		levels: [console.FATAL, console.ALERT, console.CRIT, console.ERROR, console.WARN, console.NOTICE, console.INFO],
	}, {
		type: "file",
		levels: [console.FATAL, console.ALERT, console.CRIT, console.ERROR],
		path: logPath + "error.log",
		split: "hour",
		count: 128
	}, {
		type: "file",
		levels: [console.WARN],
		path: logPath + "warn.log",
		split: "hour",
		count: 128
	}, {
		type: "file",
		levels: [console.INFO, console.NOTICE],
		path: logPath + "access.log",
		split: "hour",
		count: 128
	}]);
}

setLogs("./logs/");

// [fibos]
const fibos = require("fibos");
fibos.config_dir = "./data";
fibos.data_dir = "./data";
fibos.load("http", {
	"http-server-address": "0.0.0.0:8870",
	"access-control-allow-origin": "*",
	"http-validate-host": false,
	"verbose-http-errors": true
});

fibos.load("net", {
	"p2p-peer-address": ["127.0.0.1:9801"],
	"p2p-listen-endpoint": "0.0.0.0:9870"
});

fibos.load("producer");
fibos.load("chain", {
	"contracts-console": true,
	"delete-all-blocks": true,
	"genesis-json": "genesis.json"
});

fibos.load("chain_api");

//[fibos-tracker]
const Tracker = require("../");

Tracker.Config.DBconnString = "mysql://root:123456@127.0.0.1/fibos_chain";

Tracker.Config.isSyncSystemBlock = true;

const tracker = new Tracker();

tracker.Queues.clear();

tracker.use(require("./addons/eosio_token_transfers.js"));

tracker.emitter(fibos);

fibos.start();

// [http server]
const http = require("http");
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