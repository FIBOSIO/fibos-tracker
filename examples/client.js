require("../graphql.js");

let eosio_token_transfer_list = graphql(`
{
	find_eosio_token_transfers(
		skip: 0,
		limit: 10,
		order: "-id"
	){
		id,
		from,
		to,
 		quantity,
 		memo,
		createdAt,
 		updatedAt
    }
}`).json();

console.log(eosio_token_transfer_list);