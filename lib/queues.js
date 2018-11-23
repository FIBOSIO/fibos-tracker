module.exports = () => {
	let queues = {};

	this.put_transactions = (k, d) => {
		queues[k] = queues[k] || {
			transactions: []
		};

		queues[k].transactions.push(d);
	}

	this.put_block = (k, d) => {
		queues[k] = queues[k] || {
			transactions: []
		};
		queues[k].block = d;
	}

	this.remove = (k) => {
		delete queues[k];
	}

	this.takes = () => {
		let confirmed = [];
		let unconfirmed = [];

		for (let q in queues) {
			let d = queues[q];

			if (d.transactions && d.block)
				confirmed.push(d);
			else
				unconfirmed.push(d);
		}

		confirmed = confirmed.sort((a, b) => {
			return a.block.block_num - b.block.block_num > 0 ? 1 : -1;
		});

		unconfirmed = unconfirmed.sort((a, b) => {
			return a.block.block_num - b.block.block_num > 0 ? 1 : -1;
		});

		return {
			len: confirmed.length + unconfirmed.length,
			confirmed: confirmed,
			unconfirmed: unconfirmed
		}
	}
}