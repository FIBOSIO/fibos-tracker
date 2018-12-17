"use strict";

module.exports = db => {
	let Blocks = db.models.blocks;
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup Transactions
	 * @apiDescription Transactions Table 字段解释
	 *
	 * @apiParam {Number} id 自增长ID
	 * @apiParam {String} trx_id 交易 hash
	 * @apiParam {JSON} rawData 原始数据
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */

	let Transactions = db.define('transactions', {
		id: {
			type: "serial",
			size: 8,
			// serial: true,
			key: true,
			big: true
		},
		trx_id: {
			unique: true,
			required: true,
			type: "text",
			size: 64
		},
		rawData: {
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
						"block": {
							"find": true,
							"read": true
						},
						"actions": {
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

	Transactions.hasOne("block", Blocks, {
		reverse: "transactions"
	});

	return Transactions;
}