"use strict";

const util = require("util");
const blockCache = new util.LruCache(1000, 30 * 1000);

module.exports = db => {
	/**
	 * @api DBConfig Table Define
	 * @apiVersion 1.0.0
	 * @apiGroup FibosBlocks
	 * @apiDescription FibosBlocks Table字段解释
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

	let FibosBlocks = db.define('fibos_blocks', {
		id: {
			type: "serial",
			size: 8,
			// serial: true,
			key: true,
			big: true
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
			size: 64,
			index: "p_b_id_index"
		},
		previous: {
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
			values: ["noreversible", "reversible", "lightconfirm"],
			default: "reversible",
			index: true
		}
	});

	FibosBlocks.updateStatus = (producer_block_ids) => {
		if (!producer_block_ids.length) return;

		let rs = db.driver.execQuerySync("UPDATE `fibos_block` set status = 'noreversible', updatedAt = ? where producer_block_id in ? and status = 'reversible';", [new Date(), producer_block_ids]);

		let r = rs.affected === producer_block_ids.length;

		if (r) return true;

		console.error("[Error]Table fibos_block updateStatus affected:%s length:%s\nins:%j", rs.affected, producer_block_ids.length, producer_block_ids);

		return false;
	}

	FibosBlocks.get_sys_last = () => {
		let rs = FibosBlocks.find({}).order("-block_num").limit(1).runSync();

		return rs.length === 1 ? rs[0].block_num : 0;
	}

	FibosBlocks.get_nore_last = () => {
		let rs = FibosBlocks.find({ status: "noreversible" }).order("-block_num").limit(1).runSync();
		return rs.length === 1 ? rs[0].block_num : 0;
	}

	FibosBlocks.get = (producer_block_id) => {
		return blockCache.get("fibos_block_" + producer_block_id, () => {
			return FibosBlocks.oneSync({
				producer_block_id: producer_block_id
			});
		});
	}

	return FibosBlocks;
};