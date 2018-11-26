const test = require('test');
test.setup();

const App = require("../../");

describe("basic case", () => {

	it("config test", () => {

		let config = App.Config;

		["DBconnString", "isFilterNullBlock", "isSyncSystemBlock"].forEach((k) => {
			assert.notEqual(config[k], undefined);
		});

		App.Config.isFilterNullBlock = false;

		config = App.Config;

		assert.equal(config.isFilterNullBlock, false);

		["DBconnString", "isFilterNullBlock", "isSyncSystemBlock"].forEach((k) => {
			assert.notEqual(config[k], undefined);
		});
	});
});