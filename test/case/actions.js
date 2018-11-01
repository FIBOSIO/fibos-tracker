const test = require('test');
test.setup();

describe("actions case", () => {
	let id = 0;

	it("find actions list", () => {
		let r = graphql(`
			{
				find_actions(
					skip: 0,
					limit: 10,
					order: "-id"
				){
					id,
					trx_id,
					contract_name,
					action,
					authorization,
					data,
					createdAt,
					updatedAt
				}
			}`).json();

		assert.equal(r.data.find_actions.length, 7);
		assert.equal(r.data.find_actions[0].trx_id, "b6663a27007a38f7f9d3afc1dd3c817bb9cd167d4ec9a1facbfb2a7e36480333");
	});

	it("get actions", () => {
		let id = 1;

		let r = graphql(`
			{
				actions(id:"${id}"){
					id,
					trx_id,
					contract_name,
					action,
					authorization,
					data,
					createdAt,
					updatedAt
				}
			}`).json();

		assert.equal(r.data.actions.id, 1);
		assert.ok(r.data.actions.trx_id);
	});

	it("get extends inline_actions", () => {
		let id = 1;

		let r = graphql(`
			{
				actions(id:"${id}"){
					id,
					trx_id,
					contract_name,
					action,
					authorization,
					data,
					createdAt,
					updatedAt
					block{
						id,
						block_num,
						block_time,
						producer_block_id,
						producer,
						status,
						createdAt,
						updatedAt
					},
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
			}`).json();

		assert.equal(r.data.actions.inline_actions.length, 2);
		assert.equal(r.data.actions.block.id, 1);
	});

	it("get extends parent", () => {
		let id = 2;

		let r = graphql(`
			{
				actions(id:"${id}"){
					id,
					trx_id,
					contract_name,
					action,
					authorization,
					data,
					createdAt,
					updatedAt
					parent{
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

		assert.equal(r.data.actions.parent.id, 1);
	});
});