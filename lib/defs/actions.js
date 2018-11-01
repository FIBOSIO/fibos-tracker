"use strict";

module.exports = db => {
	let Blocks = db.models.blocks;
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup Actions
	 * @apiDescription Actions Table字段解释
	 *
	 * @apiParam {String} trx_id 交易id
	 * @apiParam {String} contract_name 合约名称
	 * @apiParam {String} action action 名称
	 * @apiParam {JSON} authorization 授权用户
	 * @apiParam {JSON} data 交易data
	 * @apiParam {JSON} rawData 原始数据
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */

	let Actions = db.define('actions', {
		trx_id: {
			required: true,
			type: "text",
			size: 64,
			index: true
		},
		contract_name: {
			required: true,
			type: "text",
			size: 12,
			index: true
		},
		action: {
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
						"inline_actions": {
							"find": true,
							"read": true
						},
						"parent": {
							"find": true,
							"read": true
						}
					}
				}
			}
		}
	});

	Actions.hasOne("parent", Actions, {}, {
		reverse: "inline_actions"
	});

	Actions.hasOne("block", Blocks, {}, {
		reverse: "actions"
	});

	return Actions;
}