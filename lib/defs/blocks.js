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
	 * @apiParam {Number} id 自增长id
	 * @apiParam {Number} block_num 区块高度
	 * @apiParam {Date} block_time 区块时间
	 * @apiParam {String} producer_block_id 区块 hash
	 * @apiParam {String} producer 区块生产者
	 * @apiParam {String} previous 向前 区块信息 [未实现]
	 * @apiParam {String} transaction_mroot 交易 Merkle根节点 [未实现]
	 * @apiParam {String} status 是否可逆状态 reversible noreversible
	 * @apiParam {Date} createdAt
	 * @apiParam {Date} changedAt
	 */

	let Blocks = db.define('blocks', {
		block_num: {
			unique: true,
			required: true,
			type: "integer",
			size: 8
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
		// previous: {
		// 	required: true,
		// 	type: "text",
		// 	size: 64
		// },
		// transaction_mroot: {
		// 	required: true,
		// 	type: "text",
		// 	size: 64
		// },
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
		let rs = db.driver.execQuerySync("UPDATE `blocks` set status = 'noreversible', updatedAt = ? where block_num <= ? and status = 'reversible';", [new Date(), bn]);
		return rs.affected;
	}

	Blocks.get_sys_last = () => {
		let rs = Blocks.find({
			status: "noreversible"
		}).order("-block_num").limit(1).runSync();

		return rs.length === 1 ? rs[0].block_num : 0;
	}

	Blocks.save = (d) => {
		return blockCache.get("blocks_" + d.block_num, () => {
			let _block = Blocks.oneSync({
				block_num: d.block_num
			});

			if (!_block) {
				d.status = "reversible";
				_block = Blocks.createSync(d);
			}

			return _block;
		});
	}

	return Blocks;
};