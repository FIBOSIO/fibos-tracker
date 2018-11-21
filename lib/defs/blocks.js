"use strict";

module.exports = db => {
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup Blocks
	 * @apiDescription Blocks Table字段解释
	 *
	 * @apiParam {Number} id 区块高度
	 * @apiParam {Date} timestamp 区块时间
	 * @apiParam {String} producer_block_id 区块 hash
	 * @apiParam {String} producer 区块生产者
	 * @apiParam {String} status 是否可逆状态 reversible noreversible
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */

	let Blocks = db.define('blocks', {
		id: {
			required: true,
			type: "integer",
			size: 8,
			key: true
		},
		timestamp: {
			required: true,
			type: "date",
			time: true
		},
		producer_block_id: {
			unique: true,
			required: true,
			type: "text",
			size: 64
		},
		producer: {
			required: true,
			type: "text",
			size: 12
		},
		status: {
			required: true,
			type: "enum",
			values: ["noreversible", "reversible"],
			default: "reversible",
			index: true
		}
	}, {
		hooks: {},
		methods: {},
		validations: {},
		functions: {},
		ACL: (session) => {
			return {
				'*': {
					"find": true,
					"read": true,
					"extends": {
						"actions": {
							"find": true,
							"read": true
						}
					}
				}
			};
		}
	});

	Blocks.updateStatus = (bn) => {
		let rs = db.driver.execQuerySync("UPDATE `blocks` set status = 'noreversible', updatedAt = ? where id <= ? and status = 'reversible';", [new Date(), bn]);
		return rs.affected;
	}

	Blocks.get_sys_last = () => {
		let rs = Blocks.find({
			status: "noreversible"
		}).order("-id").limit(1).runSync();

		return rs.length === 1 ? rs[0].id : 0;
	}

	return Blocks;
};