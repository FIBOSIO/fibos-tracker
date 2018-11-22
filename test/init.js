const http = require("http");
const Tracker = require("../");

Tracker.Config.DBconnString = "mysql://root:123456@127.0.0.1/fibos_chain";

const tracker = new Tracker();

tracker.diagram();

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