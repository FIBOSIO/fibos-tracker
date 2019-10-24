"use strict";

const test = require('test');
test.setup();

let id = 1;

describe("transactions case", () => {

	it("get transactions", () => {
		let r = graphql(`
		{
			tracker_blocks(id:"${id}") {
				id,
				trx_id,
				producer_block_id,
				rawData,
				createdAt,
				updatedAt
			}
		}`).json();
		assert.equal(r.data.transactions.id, id);
		assert.equal(r.data.transactions.trx_id, "e3630fe0f0082de9fcbf639ae447f41ccd61f27ec650e1f18939fad93c59323f");
		assert.equal(r.data.transactions.producer_block_id, "00000007424f34aeec0277755004ac9a8462ed0a9087bbd12de4ba68d76d9e10");
		assert.equal(r.data.transactions.rawData.action_traces.length, 1);
		assert.equal(r.data.transactions.rawData.block_num, 7);
		assert.equal(r.data.transactions.rawData.id, "e3630fe0f0082de9fcbf639ae447f41ccd61f27ec650e1f18939fad93c59323f");
	});
});