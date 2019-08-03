
module.exports = (app) => {
    let txbuilder = require('./tx/builder')(app);
    let txparser = require('./tx/parser')(app);

    class TX {
        constructor(data) {
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
            let tx = new txbuilder();
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
            this.parser = txparser.fromJSON(jsonobj);
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

                this.parser = txparser.fromHEX(this.raw);
                let k = this.parser.toJSON();


                if (!this.inputs)
                    this.inputs = k['in'];
                if (!this.outputs)
                    this.outputs = k['out'];

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
                this.id = this.app.tools.reverseBuffer(this.app.orwell.hash(this.raw)).toString('hex');
            }

            return this.id;
        }
        getHash(forse) {
            return this.getId(forse);
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
        isValid(context) {
            let val = new this.app.orwell.TX.VALIDATOR(this, context);
            let res = val.isValid();
            if (!res[0])
                this.validation_errors = res[1];

            return res;
        }
    }

    //create from raw lines
    //create from json
    //create coinbase

    TX.createFromJSON = function (data, keys) {

        if (!data.in || !data.out)
            throw new Error('invalid txdata format, must exist fields txdata.in[], txdata.out[], txdata.version, txdata.lock_time');

        if (!(data.in instanceof Array) || data.in.length < 1)
            throw new Error("at least one input must be in tx.in");

        if (!(data.out instanceof Array) || data.out.length < 1)
            throw new Error("at least one input must be in tx.out");

        if (!keys || keys.length < data.in.length)
            throw new Error("at least " + data.in.length + " keys must exist");

        return TX.createFromRaw(data.in, data.out, keys, data.lock_time, data.version, data.datascript);
    }

    TX.createFromRaw = function (inputs, outputs, keys, lock_time, version, ds) {
        let tx = new TX();

        if (!version)
            version = 1;

        for (let i in inputs) {
            if (inputs[i].index === 0xffffffff && (!inputs[i].hash || inputs[i].hash == '0000000000000000000000000000000000000000000000000000000000000000')) {
                inputs[i].prevAddress = app.orwell.ADDRESS.generateAddressFromPublicKey(keys[i]);
            }
        }

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

    TX.createCoinbase = function (keys, height) {
        if (!height)
            height = app.orwell.getTopInfo().height;
        //orwell network have not coinbase transaction (need pubkey of block creator)
        return TX.createFromJSON({
            version: app.cnf('consensus').version,
            in: [{ index: 0xffffffff }],
            out: [{ address: app.crypto.generateAddress(app.crypto.getPublicByPrivate(keys[0])), amount: app.pow.getBlockValue(0, height) }],
            lock: 0
        }, keys);
    }

    TX.fromJSON = function (data) {
        let tx = new TX();
        tx.fromJSON(data);
        return tx;
    }

    TX.fromHEX = function (hex) {
        let tx = new TX(hex);
        tx.fromHex();
        return tx;
    }

    TX.validate = function (tx, context) {
        return tx.isValid(context);
    }

    TX.parser = txparser;
    TX.builder = txbuilder;


    return TX;
}
