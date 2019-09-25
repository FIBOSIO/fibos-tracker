let defines = [db => {
	return db.define('eosio_token_transfers', {
		from: {
			required: true,
			type: "text",
			size: 12
		},
		to: {
			required: true,
			type: "text",
			size: 12
		},
		quantity: {
			required: true,
			type: "text",
			size: 256
		},
		memo: {
			type: "text",
			size: 256
		}
	}, {
		hooks: {},
		methods: {},
		validations: {},
		functions: {},
		ACL: function(session) {
			return {
				'*': {
					find: true,
					read: true
				}
			};
		}
	});
}];

let hooks = {
	"eosio.token/transfer": (db, messages) => {
		let eosio_token_transfers = db.models.eosio_token_transfers;
		try {
			db.trans(() => {
				messages.forEach((m) => {
					eosio_token_transfers.createSync(m.act.data);
				});
			});
		} catch (e) {
			console.error("eosio.token/transfer Error:", e);
		}
	},
	"reversible:eosio.token/transfer": (db, messages) => {
		console.log('block data: %s', messages.length);
	},
	"noreversible:eosio.token/transfer": (db, messages) => {
		console.log('noreversible data: %s', messages.length);
	}
}

module.exports = {
	defines: defines,
	hooks: hooks
}