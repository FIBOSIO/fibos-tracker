"use strict";

module.exports = db => {
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup TrackerTransactions
	 * @apiDescription Transactions Table 字段解释
	 *
	 * @apiParam {Number} id 自增长ID
	 * @apiParam {String} trx_id 交易 hash
	 * @apiParam {JSON} rawData 原始数据
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */

	let TrackerTransactions = db.define('tracker_transactions', { 
		id: {
			type: "serial",
			size: 8,
			key: true,
			big: true
		},
		producer_block_id: {
			unique: "producer_trx_id",
			required: true,
			type: "text",
			size: 64,
			index: "p_b_t_id_index"
		},
		trx_id: {
			unique: "producer_trx_id",
			required: true,
			type: "text",
			size: 64
		},
		rawData: {
			required: true,
			type: "object",
			big: true
		},
		contract_action: {
			index: true,
			type: "text",
			size: 64
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
	return TrackerTransactions;
}