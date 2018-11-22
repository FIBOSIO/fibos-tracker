const test = require('test');
test.setup();

const App = require("../../");

describe("basic case", () => {

	it("config test", () => {

		let config = App.Config;

		["DBconnString", "isFilterInvalidBlock"].forEach((k) => {
			assert.notEqual(config[k], undefined);
		});

		App.Config.isFilterInvalidBlock = false;

		config = App.Config;

		assert.equal(config.isFilterInvalidBlock, false);

		["DBconnString", "isFilterInvalidBlock"].forEach((k) => {
			assert.notEqual(config[k], undefined);
		});
	});
});