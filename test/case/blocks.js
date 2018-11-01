const test = require('test');
test.setup();

describe("blocks case", () => {

	let id = 0;

	it("find blocks list", () => {
		let r = graphql(`
			{
				find_blocks(
					skip: 0,
					limit: 10,
					order: "-block_num"
				){
					id,
					block_time,
					block_num,
					producer_block_id,
					producer,
					status,
					createdAt,
					updatedAt
				}
			}`).json();

		assert.ok(r.data.find_blocks.length > 0);
	});

	it("get extends actions", () => {
		let id = 1;

		let r = graphql(`
		{
			blocks(id:"${id}") {
				id,
				block_num,
				block_time,
				producer_block_id,
				producer,
				status,
				createdAt,
				updatedAt,
				actions {
					id,
					trx_id,
					contract_name,
					action,
					authorization,
					data,
					createdAt,
					updatedAt
					}
				}
			}`).json();

		assert.equal(r.data.blocks.id, 1);
		assert.equal(r.data.blocks.actions[0].id, 1);
	});

	it("find extends actions", () => {
		let block_num = 23;

		let r = graphql(`
		{
			find_blocks(
				where:{
					block_num: "${block_num}"
				}
			) {
				id,
				block_num,
				block_time,
				producer_block_id,
				producer,
				status,
				createdAt,
				updatedAt,
				actions {
					id,
					trx_id,
					contract_name,
					action,
					authorization,
					data,
					createdAt,
					updatedAt
					}
				}
			}`).json();

		assert.equal(r.data.find_blocks[0].actions[0].id, 1);
	});

	it("find extends actions and inline_actions", () => {
		let block_num = 23;

		let r = graphql(`
		{
			find_blocks(
				where:{
					block_num: "${block_num}"
				}
			) {
				id,
				block_num,
				block_time,
				producer_block_id,
				producer,
				status,
				createdAt,
				updatedAt,
				actions {
					id,
					trx_id,
					contract_name,
					action,
					authorization,
					data,
					createdAt,
					updatedAt
					inline_actions{
							id,
							trx_id,
							contract_name,
							action,
							authorization,
							data,
							createdAt,
							updatedAt,
							inline_actions{
								id,
								trx_id,
								contract_name,
								action,
								authorization,
								data,
								createdAt,
								updatedAt
							}
						}
					}
				}
			}`).json();

		assert.equal(r.data.find_blocks[0].actions.length, 1);

		assert.equal(r.data.find_blocks[0].actions[0].contract_name, "eosio");
		assert.equal(r.data.find_blocks[0].actions[0].action, "buyrambytes");

		assert.equal(r.data.find_blocks[0].actions[0].inline_actions.length, 2);
		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[0].contract_name, "eosio.token");
		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[0].action, "transfer");
		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[0].data.quantity, "303.6590 FO");
		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[0].inline_actions.length, 2);

		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[1].contract_name, "eosio.token");
		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[1].action, "transfer");
		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[1].data.quantity, "1.5260 FO");
		assert.equal(r.data.find_blocks[0].actions[0].inline_actions[1].inline_actions.length, 1);

	});
});