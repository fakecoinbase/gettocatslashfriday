
module.exports = (app) => {
    let txbuilder = require('./tx/builder')(app);
    let txparser = require('./tx/parser')(app);
    let dscript = require('orwelldb').datascript;

    class TX {
        constructor(data) {
            if (data)
                this.raw = data;
            this.app = app;
            this.inputs = null;
            this.ouputs = null;
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

            let k = this.parser.toJSON();

            if (!this.inputs)
                this.inputs = k['in'];
            if (!this.outputs)
                this.outputs = k['out'];

            if (k['datascript'])
                this.data = k['datascript'];

            return this;
        }
        fromHex(hex) {
            if (this.parser instanceof txparser) {
                let k = this.parser.toJSON();
                if (!this.inputs)
                    this.inputs = k['in'];
                if (!this.outputs)
                    this.outputs = k['out'];

                return this.parser;
            }

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

                if (!this.data)
                    this.data = k['datascript'];

                this.lock_time = k['lock'];
                this.version = k['version'];
                this.data = k['datascript'];

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
                this.builder.setDatascript(this.data);

            this.builder
                .sign(this.keystore)
                .verify()

            this.raw = this.builder.getSigned();
            this.fromHex();
            this.getId(true);
            return this.raw;
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
        isCoinbase() {
            if (!(this.parser instanceof txparser))
                this.fromHex();
            return this.parser.isCoinbase();
        }
        getOutputs() {
            if (!this.outputs) {
                this.fromHex();
            }
            return this.outputs
        }
        getInputs() {
            if (!this.inputs) {
                this.fromHex();
            }
            return this.inputs
        }
        send() {
            let tx = this.toJSON();
            this.app.network.protocol.sendAll("mempool.tx", tx);
            return tx.hash;
        }
        isValid(context) {
            this.prepareDataScript();
            let val = new this.app.orwell.TX.VALIDATOR(this, context);
            let res = val.isValid();
            //console.log(val.getLog());
            if (!res)
                this.validation_errors = val.getErrors();

            return res;
        }
        getLastErrorCodes() {
            let codes = [];
            for (let i in this.validation_errors) {
                codes.push(this.validation_errors[i].code);
            }

            return codes.join(",");
        }
        prepareDataScript() {//before validation we need prepare datascript of tx
            if (!this.data || this.isCoinbase())
                return;

            let tx = this.toJSON();
            let arr = this.data;
            let datascripts = {}, dsvalid = 0;
            for (let i in arr) {
                let ds = new dscript(arr[i]).toJSON();
                if (!datascripts[ds.dataset])
                    datascripts[ds.dataset] = [];
                if (ds.success) {
                    dsvalid++;
                    datascripts[ds.dataset].push(ds);
                }
            }

            let dbname = app.orwell.SCRIPT.scriptToAddrHash(tx.out[0].script).toString('hex');
            let dbaddress = app.orwell.SCRIPT.scriptToAddr(tx.out[0].script);
            let a = app.orwell.SCRIPT.sigToArray(tx.in[0].sig);

            this.preparedDS = {
                dbaddress: dbaddress,
                dbname: dbname,
                writer_key: a.publicKey,
                count: dsvalid,
                data: datascripts
            }
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
                inputs[i].prevAddress = app.orwell.ADDRESS.generateAddressFromPublicKey(app.crypto.getPublicByPrivate(keys[i]));
            }
        }

        tx
            .setVersion(version)
            .setInputs(inputs)
            .setOutputs(outputs)
            .setKeystore(keys)

        if (lock_time)
            tx.setLockTime(lock_time);

        if (ds)
            tx.attachData(ds);

        tx.toHex();
        return tx;
    }

    TX.createCoinbase = function (fee, coinbaseBytes, keys, height) {
        if (!fee)
            fee = 0;

        if (!height)
            height = app.orwell.getTopInfo().height;
        if (app.cnf('consensus').genesisMode)
            height = -1;
        //orwell network have not coinbase transaction (need pubkey of block creator)
        
        return TX.createFromJSON({
            version: app.cnf('consensus').version,
            in: [{ index: 0xffffffff, coinbase: coinbaseBytes }],
            out: [{ address: app.orwell.ADDRESS.generateAddressFromPublicKey(app.crypto.getPublicByPrivate(keys[0])), amount: app.orwell.getBlockValue(fee, height + 1) }],
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
