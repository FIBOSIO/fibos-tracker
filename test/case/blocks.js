"use strict";

const test = require('test');
test.setup();

let id = 1;

describe("blocks case", () => {
	it("find blocks list", () => {
		let r = graphql(`
			{
				find_tracker_blocks(
					skip: 0,
					limit: 10,
					order: "-id"
				){
					id,
					block_num,
					block_time,
					producer_block_id,
					producer,
					status,
					createdAt,
					updatedAt
				}
			}`).json();

		assert.equal(r.data.find_blocks.length, 1);
		assert.equal(r.data.find_blocks[0].id, id);
		assert.equal(r.data.find_blocks[0].block_num, 7);
		assert.equal(r.data.find_blocks[0].status, "reversible");
	});
});