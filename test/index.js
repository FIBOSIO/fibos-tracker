"use strict";

const fs = require("fs");
const test = require('test');
const path = require("path");

["", "\-shm", "\-wal"].forEach(function(k) {
	if (fs.exists("./fibos_chain.db" + k)) fs.unlink("./fibos_chain.db" + k);
});

require("./init.js");
require("../graphql.js");

if (process.argv.length === 3) {
	run(`./case/${process.argv[2]}`)
} else {
	fs.readdir(path.join(__dirname, "./case"))
		.filter(f => f.slice(-3) == ".js")
		.forEach(f => run(`./case/${f}`));
}

test.run(console.INFO);

process.exit();