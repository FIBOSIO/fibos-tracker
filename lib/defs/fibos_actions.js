"use strict";

module.exports = db => {
    let FibosActions = db.define('fibos_actions', {
        id: {
            type: "serial",
            size: 8,
            key: true,
            big: true
        },
        global_sequence: {
            required: true,
            type: "text",
            size: 64
        },
        trx_id: {
            required: true,
            type: "text",
            size: 64
        },
        contract_action: {
            required: true,
            type: "text",
            size: 64
        },
        rawData: {
            required: true,
            type: "object",
            big: true
        }
    });

    FibosActions.hasOne('parent', FibosActions, {
        key: true,
        reverse: "action"
    });

    FibosActions.hasOne('transaction', db.models.fibos_transactions, {
        key: true,
        reverse: "action"
    });

    return FibosActions;
}