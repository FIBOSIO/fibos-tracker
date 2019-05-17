"use strict";

const http = require("http");
const Tracker = require("../");
const fs = require("fs");

const fibos = require("fibos");

const config = {
	"config_dir": "./blockData/data",
	"data_dir": "./blockData/data",
	"p2p": [
		'127.0.0.1:9801',
		'127.0.0.1:9802',
		'127.0.0.1:9803',
		'127.0.0.1:9804',
		'127.0.0.1:9805'
	],
	"DBconnString": "mysql://root:123456@127.0.0.1/fibos_mainnet"
};

fibos.config_dir = config.config_dir;
fibos.data_dir = config.data_dir;

console.notice("config_dir:", fibos.config_dir);
console.notice("data_dir:", fibos.data_dir);


fibos.load("http", {
	"http-server-address": "0.0.0.0:8888",
	"access-control-allow-origin": "*",
	"http-validate-host": false,
	"verbose-http-errors": true
});


fibos.load("net", {
	"p2p-peer-address": config.p2p,
	"max-clients": 100,
	"p2p-listen-endpoint": "0.0.0.0:9999",
	"agent-name": "FIBOS Seed"
});

let chain_config = {
	"contracts-console": true,
	'chain-state-db-size-mb': 8 * 1024,
	"delete-all-blocks": true
};

chain_config['genesis-json'] = "genesis.json";

fibos.load("producer", {
	'max-transaction-time': 3000
});

fibos.load("chain", chain_config);
fibos.load("chain_api");
fibos.load("emitter");


Tracker.Config.DBconnString = config.DBconnString;
const tracker = new Tracker();
tracker.emitter(fibos);

tracker.work();
fibos.start();