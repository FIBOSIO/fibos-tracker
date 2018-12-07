"use strict";

const http = require("http");
const Tracker = require("../");
const mock_db = require("./mock_db.json");

if (process.env.TEST_USE_MYSQL)
	Tracker.Config.DBconnString = process.env.TEST_USE_MYSQL.startsWith('mysql://') ?  process.env.TEST_USE_MYSQL : "mysql://root:123456@127.0.0.1/fibos_chain";
	
Tracker.Config.isSyncSystemBlock = true;

const tracker = new Tracker();

tracker.diagram();

tracker.Queues.clear();

tracker.Queues.put(mock_db);

tracker.work();

const port = require('../port')

let httpServer = new http.Server(port, [
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