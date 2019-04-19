let txbuilder = require('./tx/builder');
let txparser = require('./tx/parser');


class TX {
    constructor(app, data) {
        if (data)
            this.raw = data;
        this.app = app;
        this.inputs = [];
        this.ouputs = [];
        this.data = null;
        this.coinbase = 0;
        this.version = 1;
        this.isValidTransaction = 1;
        this.keystore = null;
    }
    fromCoinBase(data, addrs) {
        this.coinbase = 1;
        let tx = new txbuilder(this.app);
        tx.setCoinbase(data, addrs).generate();
        this.raw = tx.getCoinBase();
        this.fromHex();
        return this;
    }
    setInputs(arr) { //array of [tx, indexoutinthistx, addrin]
        this.inputs = arr;
        return this;
    }
    setOutputs(arr) {//array of [amountin satoshi, addrout]
        this.outputs = arr;
        return this;
    }
    toJSON(simple) {
        if (!(this.parser instanceof txparser))
            this.fromHex();

        if (this.parser instanceof txparser)
            return this.parser.toJSON(simple);
    }
    fromJSON(jsonobj) {
        this.parser = txparser.fromJSON(this.app, jsonobj);
        this.raw = this.parser.raw;
        return this;
    }
    fromHex(hex) {
        if (this.parser instanceof txparser)
            return this.parser;

        if (!this.raw && !hex)
            this.toHex();

        if (this.raw || hex) {
            if (hex)
                this.raw = hex;

            this.parser = txparser.fromHEX(this.app, this.raw);
            let k = this.parser.toJSON();

            if (!this.inputs)
                this.inputs = k['inputs'];
            if (!this.outputs)
                this.outputs = k['outputs'];

            return this;
        } else
            throw new Error('Need hex value to tx');
    }
    setKeystore(keys) {
        this.keystore = keys;
        return this;
    }
    setLockTime(lock_time) {
        this.lock_time = lock_time;
        return this;
    }
    setVersion(version) {
        this.version = version;
        return this;
    }
    attachData(data) {
        this.data = data;
        return this;
    }
    toHex() {

        if (this.raw)
            return this.raw;

        if ((this.inputs.length <= 0 || this.outputs.length <= 0) && !this.coinbase)
            throw new Error('input and out of tx must exist');

        this.builder = new txbuilder(this.app);
        this.builder
            .setVersion(this.version)
            .setInputs(this.inputs)
            .setOutputs(this.outputs);

        if (this.lock_time)
            this.builder.setLockTime(this.lock_time);

        if (this.data)
            this.builder.attachData(this.data);

        this.builder
            .sign(this.keystore)
            .verify()

        return this.raw = this.builder.getSigned()

    }
    getId(forse) {
        if (!this.id || forse) {

            if (!this.raw)
                this.toHex();
            this.id = this.app.tools.reverseBuffer(this.app.btcchain.hash(this.raw)).toString('hex');
        }

        return this.id;
    }
    getHash() {
        return this.getId();
    }
    getFee() {
        if (!(this.parser instanceof txparser))
            this.fromHex();
        return this.parser.getFee();
    }
    getSize() {
        if (!(this.parser instanceof txparser))
            this.fromHex();
        return this.parser.getSize();
    }
    getOutputs() {
        if (!this.outputs) {
            if (!(this.parser instanceof txparser))
                this.fromHex();
        }
        return this.outputs
    }
    getInputs() {
        if (!this.inputs) {
            if (!(this.parser instanceof txparser))
                this.fromHex();
        }
        return this.inputs
    }
    send() {



    }
}

//create from raw lines
//create from json
//create coinbase

TX.createFromJSON = function (app, data, keys) {

    if (!data.in || !data.out)
        throw new Error('invalid txdata format, must exist fields txdata.in[], txdata.out[], txdata.version, txdata.lock_time');

    if (!(data.in instanceof Array) || data.in.length < 1)
        throw new Error("at least one input must be in tx.in");

    if (!(data.out instanceof Array) || data.out.length < 1)
        throw new Error("at least one input must be in tx.out");

    if (!keys || keys.length < data.in.length)
        throw new Error("at least " + data.in.length + " keys must exist");

    return TX.createFromRaw(app, data.in, data.out, keys, data.lock_time, data.version, data.datascript);
}

TX.createFromRaw = function (app, inputs, outputs, keys, lock_time, version, ds) {
    let tx = new TX(app);

    if (!version)
        version = 1;

    tx
        .setInputs(inputs)
        .setOutputs(outputs)
        .setKeystore(keys)

    if (lock_time)
        tx.setLockTime(lock_time);

    tx.setVersion(version);

    if (ds)
        tx.attachData(ds);

    tx.toHex();
    return tx;
}

TX.createCoinbase = function (app, txdata) {

    if (!txdata.in || !txdata.out)
        throw new Error('invalid txdata format, must exist fields txdata.in[], txdata.out[], txdata.version, txdata.lock_time');

    let tx = new TX(app);
    tx
        .fromCoinBase(txdata.in[0], txdata.out)
        .setVersion(txdata.version)
        .setLockTime(txdata.lock_time)
        .toHex();
    return tx;
}

TX.fromJSON = function (app, data) {
    let tx = new TX(app);
    tx.fromJSON(data);
    return tx;
}

TX.fromHEX = function (app, hex) {
    let tx = new TX(app, hex);
    tx.fromHex();
    return tx;
}


TX.validate = function (app, tx, type, context) {
    //context.trigger is mempool|sync|blockvalidate - mempool is new tx, sync is tx from syncing node, blockvalidate - validate in block-validating, context in this case have context.parent (block context.trigger) 
    if (!type)
        type = 'common';//coinbase|common

    //valid key same:
    //valid signature
    //todo:
    let txver = new Verifier(app, tx);
    if (!txver.isVerified())
        return { error: true, message: 'Tx sign is not valid for ' + tx.hash, code: 'invalid-sign' };

    //valid hash
    if (tx.getId(true) != tx.hash)
        return { error: true, message: 'Tx hash is not valid for ' + tx.hash, code: 'invalid-hash' };

    //todo: context
    let errors = Rules.check(tx, context);

    if (!errors.length) {
        return { error: false };
    } else
        return errors;
}

class Verifier {

    constructor(app, tx) {
        this.app = app;
        this.data = tx;

        if (!this.data)
            throw new Error('Txdata is required for tx');

        this.verified = true;
        this.verify();
    }
    verify() {

    }
    isVerified() {
        return this.verified;
    }
}

let Rules = {

    list: {},
    add: function (code, callback) {
        if (Rules.list[code])
            throw new Error('Rule ' + code + ' already exist');
        Rules.list[code] = callback;
    },
    remove: function (code) {
        delete Rules.list[code]
    },
    check: function (tx, context) {
        let errors = [];
        for (let i in Rules.list) {
            let res = Rules.list[i](tx, context);
            if (res.error) {
                errors.push(res);
            }
        }

        return errors;
    }

}

TX.rules = Rules;
TX.parser = txparser;
TX.builder = txbuilder;
TX.verifier = Verifier;

module.exports = TX;