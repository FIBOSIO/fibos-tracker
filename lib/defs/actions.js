"use strict";

module.exports = db => {
	let Transactions = db.models.transactions;
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup Actions
	 * @apiDescription Actions Table字段解释
	 *
	 * @apiParam {Number} id action global_sequence
	 * @apiParam {String} contract_name 合约名称
	 * @apiParam {String} action_name action_name 名称
	 * @apiParam {JSON} authorization 授权用户
	 * @apiParam {JSON} data 交易data
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */

	let Actions = db.define('actions', {
		id: {
			type: "serial",
			size: 8,
			key: true
		},
		contract_name: {
			required: true,
			type: "text",
			size: 12,
			index: true
		},
		action_name: {
			required: true,
			type: "text",
			size: 12
		},
		authorization: {
			required: true,
			type: "object"
		},
		data: {
			required: true,
			type: "object",
			big: true
		}
	}, {
		hooks: {},
		methods: {},
		validations: {},
		functions: {},
		ACL: (session) => {
			return {
				"*": {
					"find": true,
					"read": true,
					"extends": {
						"transaction": {
							"find": true,
							"read": true
						},
						"inline_actions": {
							"find": true,
							"read": true
						},
						"parent": {
							"find": true,
							"read": true
						}
					}
				},
				roles: {
					"god": {
						'*': true
					}
				}
			}
		}
	});

	Actions.hasOne("parent", Actions, {
		reverse: "inline_actions"
	});

	Actions.hasOne("transaction", Transactions, {
		reverse: "actions"
	});

	return Actions;
}