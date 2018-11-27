"use strict";

const http = require("http");
const coroutine = require("coroutine");
const Tracker = require("../");
const mock_db = require("./mock_db.json");

Tracker.Config.DBconnString = "mysql://root:123456@127.0.0.1/fibos_chain";
Tracker.Config.isSyncSystemBlock = true;

const tracker = new Tracker();

tracker.diagram();

tracker.Queues.clear();

for (var k in mock_db) {
	tracker.Queues.put(k, mock_db[k]);
}

tracker.work();

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