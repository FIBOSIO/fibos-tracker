const test = require('test');
test.setup();

let id = 13;

describe("blocks case", () => {

	it("find blocks list", () => {
		let r = graphql(`
			{
				find_blocks(
					skip: 0,
					limit: 10,
					order: "-id"
				){
					id,
					block_time,
					producer_block_id,
					producer,
					status,
					createdAt,
					updatedAt
				}
			}`).json();

		assert.equal(r.data.find_blocks.length, 10);
	});

	it("get transactions", () => {
		let r = graphql(`
		{
			blocks(id:"${id}") {
				id,
				block_time,
				producer_block_id,
				producer,
				status,
				createdAt,
				updatedAt,
				transactions {
					id,
					trx_id,
					rawData,
					createdAt,
					updatedAt
					}
				}
			}`).json();

		assert.equal(r.data.blocks.id, id);
		assert.equal(r.data.blocks.transactions.length, 2);
	});

	it("find extends actions", () => {
		let r = graphql(`
		{
			find_blocks(
				where:{
					id: "${id}"
				}
			) {
				id,
				block_time,
				producer_block_id,
				producer,
				status,
				createdAt,
				updatedAt,
				transactions {
					id,
					trx_id,
					actions {
						id,
						contract_name,
						action_name,
						authorization,
						data,
						createdAt,
						updatedAt
					},
					createdAt,
					updatedAt
					}
				}
			}`).json();

		assert.equal(r.data.find_blocks[0].id, id);
		assert.equal(r.data.find_blocks[0].transactions.length, 2);
		assert.equal(r.data.find_blocks[0].transactions[0].actions.length, 1);
	});
});