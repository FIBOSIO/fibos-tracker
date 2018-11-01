const test = require('test');
test.setup();

const App = require("../../");

describe("basic case", () => {

	it("config test", () => {

		let config = App.Config;

		["DBconnString", "emitterNodePort", "onblockEnable"].forEach((k) => {
			assert.notEqual(config[k], undefined);
		});

		App.Config.onblockEnable = true;

		config = App.Config;

		assert.equal(config.onblockEnable, true);

		["DBconnString", "emitterNodePort", "onblockEnable"].forEach((k) => {
			assert.notEqual(config[k], undefined);
		});
	});
});