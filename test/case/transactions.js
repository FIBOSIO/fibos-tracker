"use strict";

const test = require('test');
test.setup();

let id = 1;

describe("transactions case", () => {

	it("get transactions", () => {
		let r = graphql(`
		{
			transactions(id:"${id}") {
				id,
				trx_id,
				createdAt,
				updatedAt,
				actions {
					id,
					contract_name,
					action_name,
					authorization,
					data,
					createdAt,
					updatedAt
					}
				}
			}`).json();

		assert.equal(r.data.transactions.id, id);
		assert.equal(r.data.transactions.actions.length, 3);

		assert.equal(r.data.transactions.actions[0].contract_name, "eosio");
		assert.equal(r.data.transactions.actions[0].action_name, "newaccount");
		assert.equal(r.data.transactions.actions[1].action_name, "buyrambytes");
		assert.equal(r.data.transactions.actions[2].action_name, "delegatebw");

	});

	it("find extends actions and inline_actions", () => {
		let r = graphql(`
		{
			transactions(id:"${id}") {
				id,
				trx_id,
				createdAt,
				updatedAt,
				actions {
					id,
					contract_name,
					action_name,
					authorization,
					data,
					createdAt,
					updatedAt
					inline_actions{
							id,
							contract_name,
							action_name,
							authorization,
							data,
							createdAt,
							updatedAt,
							inline_actions{
								id,
								contract_name,
								action_name,
								authorization,
								data,
								createdAt,
								updatedAt
							}
						}
					}
				}
			}`).json();

		assert.equal(r.data.transactions.actions[0].action_name, "newaccount");
		assert.equal(r.data.transactions.actions[0].inline_actions.length, 0);

		assert.equal(r.data.transactions.actions[1].action_name, "buyrambytes");
		assert.equal(r.data.transactions.actions[1].inline_actions[0].contract_name, "eosio.token");
		assert.equal(r.data.transactions.actions[1].inline_actions[0].action_name, "transfer");
		assert.equal(r.data.transactions.actions[1].inline_actions[0].inline_actions.length, 2);


		assert.equal(r.data.transactions.actions[2].action_name, "delegatebw");
		assert.equal(r.data.transactions.actions[2].inline_actions[0].contract_name, "eosio.token");
		assert.equal(r.data.transactions.actions[2].inline_actions[0].action_name, "transfer");
		assert.equal(r.data.transactions.actions[2].inline_actions[0].inline_actions.length, 2);
	});
});