let txbuilder = require('./tx.builder');
let txverifier = require('./tx.verifier')
let txRules = require('./tx.rules');

class TX {

    constructor(app, txdata, type, additionalInfo) {
        this.app = app;
        this.type = type;
        if (!type || type == 'create' || type == 'create/coinbase') {
            let res;
            if (!type || type == 'create') {
                this.rawdata = txdata;
                res = this.build(additionalInfo);
            }

            if (type == 'create/coinbase') {
                this.rawdata = txdata;
                res = this.buildCoinbase(additionalInfo);
            }

            this.timestamp = res.getTimestamp();
            this.key = res.getKey();
            this.sign = res.getSign();
            this.data = res.getData();
        }

        if (type == 'load') {
            this.hash = txdata.hash;
            this.timestamp = txdata.timestamp;
            this.key = txdata.key;
            this.sign = txdata.sign;
            this.data = txdata.data;
        }

    }
    build(keystore) {
        var tx = new txbuilder(this.app, this.rawdata, keystore);
        this.raw = tx.getBuffer();
        this.hash = this.app.pow.hash(this.raw).toString('hex');
        return tx;
    }
    buildCoinbase(keystore) {
        var tx = new txbuilder(this.app, this.rawdata, keystore, 'coinbase');
        this.raw = tx.getBuffer();
        this.hash = this.app.pow.hash(this.raw).toString('hex');
        return tx;
    }
    buildHash() {
        var tx = new txbuilder(this.app, {
            timestamp: this.timestamp,
            key: this.key,
            signature: this.sign,
            data: this.data
        }, null, 'hash');
        let r = tx.getBuffer();
        return this.app.pow.hash(r).toString('hex');
    }
    toJSON() {
        return {
            timestamp: this.timestamp,
            sign: this.sign,
            key: this.key,
            data: this.data,
            hash: this.hash,
        }
    }
}

TX.create = function (app, data, keystore) {
    if (!keystore && !keystore.privateKey) {
        keystore = app.wallet.findAddrByAccount("0");
    }

    return new TX(app, data, 'create', keystore);
}

TX.createCoinbase = function (app, data, keystore) {
    if (!keystore || !keystore.privateKey) {
        keystore = app.wallet.findAddrByAccount("0");
    }

    return new TX(app, data, 'create/coinbase', keystore);
}

TX.fromJSON = function (app, data) {
    return new TX(app, data, 'load');
}

TX.toJSON = function (tx) {
    return tx.toJSON()
}

TX.validate = function (app, tx, type, context) {
    //context.trigger is mempool|sync|blockvalidate - mempool is new tx, sync is tx from syncing node, blockvalidate - validate in block-validating, context in this case have context.parent (block context.trigger) 
    if (!type)
        type = 'common';//coinbase|common

    //valid time
    const week = 7 * 24 * 60 * 60;
    if ((tx.timestamp <= 0 && type !== 'coinbase') || tx.timestamp > (Date.now() / 1000 + week))
        return { error: true, message: 'Invalid timestamp of tx ' + tx.hash, code: 'invalid-timestamp' };

    //valid key same:
    //valid signature
    let txver = new txverifier(app, tx);
    if (!txver.isVerified())
        return { error: true, message: 'Tx sign is not valid for ' + tx.hash, code: 'invalid-sign' };

    //valid hash
    if (tx.buildHash() != tx.hash)
        return { error: true, message: 'Tx hash is not valid for ' + tx.hash, code: 'invalid-hash' };

    //todo: context
    let errors = txRules.check(tx, context);

    if (!errors.length) {
        return { error: false };
    } else
        return errors;
}

TX.rules = txRules;
module.exports = TX;