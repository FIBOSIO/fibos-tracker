"use strict";

const util = require("util");
const blockCache = new util.LruCache(1000, 30 * 1000);

module.exports = db => {
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup Blocks
	 * @apiDescription Blocks Table字段解释
	 *
	 * @apiParam {Number} id 自增长 id
	 * @apiParam {Number} block_num 区块高度
	 * @apiParam {Date} block_time 区块时间
	 * @apiParam {String} producer_block_id 区块 hash
	 * @apiParam {String} producer 区块生产者
	 * @apiParam {String} status 是否可逆状态 reversible noreversible
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */

	let Blocks = db.define('blocks', {
		id: {
			type: "serial",
			size: 8,
			key: true
		},
		block_num: {
			required: true,
			type: "integer",
			size: 8,
			index: true
		},
		block_time: {
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
						"transactions": {
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
			};
		}
	});

	Blocks.updateStatus = (producer_block_ids) => {
		if (!producer_block_ids.length) return;

		let rs = db.driver.execQuerySync("UPDATE `blocks` set status = 'noreversible', updatedAt = ? where producer_block_id in ? and status = 'reversible';", [new Date(), producer_block_ids]);

		let r = rs.affected === producer_block_ids.length;

		if (r) return true;

		console.error("[Error]Table blocks updateStatus affected:%s length:%s\nins:%j", rs.affected, producer_block_ids.length, producer_block_ids);

		return false;
	}

	Blocks.get_sys_last = () => {
		let rs = Blocks.find({
			status: "noreversible"
		}).order("-block_num").limit(1).runSync();

		return rs.length === 1 ? rs[0].block_num : 0;
	}

	Blocks.get = (producer_block_id) => {
		return blockCache.get("blocks_" + producer_block_id, () => {
			return Blocks.oneSync({
				producer_block_id: producer_block_id
			});
		});
	}

	return Blocks;
};