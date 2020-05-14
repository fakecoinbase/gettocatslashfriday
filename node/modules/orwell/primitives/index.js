const PRIMITIVES = require('@nanocat/friday-serialized');
const dscript = require('orwelldb').datascript;

module.exports = (friday) => {

    let app = new PRIMITIVES(friday.cnf('consensus'));

    app.definePrimitive((() => {
        class Privitive2 extends app.PRIMITIVE {
            constructor() {
                super();
            }
            throwError(message, code) {
                friday.throwError(message, code)
            }
            getAddressByPublicKey(publicKeyHex) {
                return friday.orwell.ADDRESS.generateAddressFromPublicKey(publicKeyHex);
            }
            getPublicKeyByPrivateKey(privateKeyHex) {
                return friday.crypto.getPublicByPrivate(privateKeyHex);
            }
            getBlockValue(fee, height) {
                return friday.orwell.getBlockValue(fee, height);
            }
            isValidAddress(address) {
                return friday.orwell.ADDRESS.isValidAddress(address);
            }
            createHash(binaryOrHex) {
                return friday.orwell.hash(binaryOrHex).toString('hex');
            }
            sign(privateKeyBinaryOrHex, hash) {
                return friday.crypto.sign(new Buffer(privateKeyBinaryOrHex, 'hex'), hash);
            }
            verify(pubkey, sign, hash2sign) {
                return friday.crypto.verify(pubkey, sign, new Buffer(hash2sign, 'hex'));
            }
            getOut(hash, index) {
                return friday.orwell.getOut(hash, index)
            }
            getMerkleRoot(list) {
                return friday.tools.merkleTree(list);
            }
            createMerkle(list) {
                return this.getMerkleRoot(list);
            }
            getMemPool() {
                return friday.orwell.getMemPool();
            }
            getTop() {
                return friday.orwell.index.getTop();
            }
            createCoinbaseOutputs(privateKey, fullamount, validators) {
                let currnode = this.getPublicKeyByPrivateKey(privateKey);
                let outs = [

                ];

                let lessamount = fullamount * .05;

                let balances = {};
                let full_calc = 0;
                for (let i in validators) {
                    let am = Math.floor(lessamount / (validators.length - 1));
                    if (validators[i] == currnode)
                        am = Math.floor(fullamount * .95);

                    balances[validators[i]] = am;
                    full_calc += am;
                }

                //becauseof floor 
                let part = fullamount - full_calc;

                for (let i in validators) {
                    outs.push({
                        key: validators[i],
                        address: this.getAddressByPublicKey(validators[i]),
                        amount: (validators[i] == currnode) ? (balances[validators[i]] + part) : balances[validators[i]]
                    })
                }

                return outs;
            }

        }

        return Privitive2;
    })(app))

    class Tx2 extends app.TX {
        static writeCoinbaseBytes(authorName, hardware, signalBytes) {
            let wr = new bitPony.writer(new Buffer("", 'hex'));
            wr.string(authorName, true);
            wr.string(hardware, true);
            wr.uint32(Date.now() / 1000, true);
            wr.var_int(signalBytes.length, true);
            for (let i in signalBytes) {
                wr.uint8(signalBytes[i], true);
            }

            return wr.toBuffer();
        }
        static readCoinbaseBytes(cb) {
            let cbData = {};
            try {
                let reader = new bitPony.reader(new Buffer(cb, 'hex'));
                let res = reader.string(0);
                cbData['authorName'] = res.result.toString();
                res = reader.string(res.offset);
                cbData['hardwareName'] = res.result.toString();
                res = reader.uint32(res.offset);
                cbData['time'] = res.result;
                res = reader.var_int(res.offset);
                cbData['bytes_length'] = res.result;
                cbData['bytes'] = [];
                let offset = res.offset;

                for (let m = 0; m < cbData['bytes_length']; m++) {
                    res = reader.uint8(offset);
                    cbData['bytes'].push(parseInt(res.result).toString(16));
                    offset = res.offset;
                }
            } catch (e) {
                cbData['bytes'] = cb ? cb.length / 2 : 0;
                cbData['bytes'] = new Buffer(cb, 'hex').toJSON().data;
            }

            return cbData;
        }
        constructor(data) {
            super(data);

            this.on("beforevalidation", () => {
                this.prepareDataScript();
            })

        }
        send() {
            return new Promise((resolve, reject) => {
                let tx = this.toJSON('hash');

                friday.on("app.orwell.tx" + tx.hash, (status, tx, errcode, errmsg) => {
                    if (!status)
                        reject(tx.hash);
                    else
                        resolve(tx.hash);
                });

                friday.network.protocol.sendAll("mempool.tx", tx);

            })
        }
        prepareDataScript() {//before validation we need prepare datascript of tx
            if (!this.data || this.isCoinbase())
                return;

            let arr = dscript.readArray(this.data);
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

            let dbname = friday.orwell.ADDRESS.getPublicKeyHashByAddress(this.outputs[0].address).toString('hex');
            let dbaddress = this.outputs[0].address;
            let writerKey = this.signdata[0][1];
            this.preparedDS = {
                dbaddress: dbaddress,
                dbname: dbname,
                writer_key: writerKey,
                count: dsvalid,
                data: datascripts
            }

        }
        toJSON(rules) {
            let o = super.toJSON(rules);
            if (!rules || rules.length < 1)
                return o;

            let rul = rules.split(',');
            if (rul.indexOf('height') != -1) {
                let txblock = friday.orwell.index.get('tx/' + o.hash).block;
                o.height = friday.orwell.index.get('block/' + txblock).height
            }

            if (rul.indexOf('confirmation') != -1) {
                let txblock = friday.orwell.index.get('tx/' + o.hash).block;
                o.confirmation = friday.orwell.index.getTop().height - friday.orwell.index.get('block/' + txblock).height + 1;
            }

            if (rul.indexOf('fee') != -1) {
                o.fee = this.getFee();
            }

            if (rul.indexOf('size') != -1) {
                o.size = this.getSize();
            }

            if (rul.indexOf('fromBlock') != -1 || rul.indexOf('fromIndex') != -1) {
                let txblock = friday.orwell.index.get('tx/' + o.hash);
                o.fromBlock = txblock.block;
                o.fromIndex = txblock.index;
            }

            if (rul.indexOf('time') != -1) {
                let txblock = friday.orwell.index.get('tx/' + o.hash).block;
                let b = friday.orwell.consensus.dataManager.getData(txblock);
                o.time = b.t;
            }

            if (rul.indexOf('hrk') != -1) {//human readable keys
                o.version = o.v;
                o.prev = o.p;
                o.merkle = o.m;
                o.time = o.t;
                o.bits = o.b;
                o.nonce = o.n;
            }

            return o;
        }
    }

    class Block2 extends app.BLOCK {
        static getVersionFieldName() {
            return 'version';
        }

        static getIdFieldName() {
            return 'hash';
        }

        static getPrevIdFieldName() {
            return 'hashPrevBlock';
        }

        static getTimeFieldName() {
            return 'time';
        }

        static getBitsFieldName() {
            return 'bits';
        }
        static getNonceFieldName() {
            return 'nonce';
        }
        static generateNewBlockTemplate(timestamp, coinbaseBytes, keystore, currentValidators) {
            let blockTemplate = super.generateNewBlockTemplate(timestamp, coinbaseBytes, keystore, currentValidators);

            blockTemplate.nonce = currentValidators.indexOf(keystore.public);
            if (blockTemplate.nonce == -1)
                throw new Error('Invalid nonce, public key not in validator list')
            return blockTemplate;
        }
        constructor() {
            super();
            this._serialized_version = 1;
        }
        send() {
            friday.network.protocol.sendAll('block', this.toJSON());
        }
        getKey() {//get public key of block (used for pos consensus, need sign coinbase block too)
            return this.tx[0].key;
        }
        getValidatorsMerkle() {
            return this.tx[0].merkle;
        }
        getValidators() {
            let keys = [];
            let outs = this.tx[0].getOutputs();
            for (let i in outs) {
                if (outs[i].key)
                    keys.push(outs[i].key);
            }
            return keys;
        }
        getStakeValue(height) {
            return friday.validatorManager.getValidatorVolume(this.getKey(), height);
        }
        isDelegateMessage() {
            return !!friday.orwell.dsIndex.getMasternode(this.getKey()).key || friday.cnf('consensus').delegates.indexOf(this.getKey()) != -1;
        }
        isImportant() {
            return true;
        }
        toJSON(rules) {
            let o = super.toJSON(rules);
            if (!rules || rules.length < 1)
                return o;
            let rul = rules.split(',');
            if (rul.indexOf('height') != -1) {
                o.height = friday.orwell.index.get('block/' + o.hash).height;
            }

            if (rul.indexOf('confirmation') != -1) {
                o.confirmation = friday.orwell.index.getTop().height - friday.orwell.index.get('block/' + o.hash).height + 1;
            }

            if (rul.indexOf('fee') != -1) {
                o.fee = this.getFee();
            }

            if (rul.indexOf('size') != -1) {
                o.size = this.getSize();
            }

            if (rul.indexOf('hrk') != -1) {//human readable keys
                o.version = o.v;
                o.prev = o.p;
                o.merkle = o.m;
                o.time = o.t;
                o.bits = o.b;
                o.nonce = o.n;
            }

            return o;
        }
    }

    app.defineBlock(Block2);
    app.defineTx(Tx2);

    return {
        Block: Block2,
        Transaction: Tx2
    };

}