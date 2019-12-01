
module.exports = (app) => {

    class block {

        constructor(header, txList) {
            this.vtx = [];
            this.validation_errors = [];
            this.hashMerkleRoot = null;
            this.hash = null;
            this.nonce = 0;
            this.app = app;

            if (txList instanceof Array)
                this.addTxList(txList);

            this.setBlockHeader(header);
        }
        setBlockHeader(header) {
            this.version = header.version;
            this.hashPrevBlock = header.prev;
            this.hashMerkleRoot = header.merkle;
            this.time = parseInt(header.time);
            this.bits = header.bits;
            this.nonce = header.nonce;
            this.index = this.height = header.height;
            if (header.hash)
                this.hash = header.hash;
        }
        getBlockHeader() {
            let h = {};
            h.version = this.version;
            h.prev = this.hashPrevBlock;
            h.merkle = this.hashMerkleRoot
            h.time = this.time;
            h.bits = this.bits;
            h.nonce = this.nonce;
            h.index = h.height = this.height
            h.confirmation = this.confirmation;
            return h;
        }
        addTxFromHEX(hex) {
            let t = new this.app.orwell.TX.fromHEX(this.app, hex);
            this.vtx.push(t);
            return this;
        }
        addTxFromJSON(json) {
            let t = new this.app.orwell.TX.fromJSON(this.app, json);
            this.vtx.push(t);
            return this;
        }
        addTx(tx) {
            if (!(tx instanceof this.app.orwell.TX))
                this.app.throwErrorByCode('orwell', 'not_tx_obj');
            this.vtx.push(tx);
            return this;
        }
        addTxList(hexArr) {
            for (let i in hexArr) {
                if (hexArr[i] instanceof this.app.orwell.TX)
                    this.vtx.push(hexArr[i])
                else if ((typeof hexArr[i] === 'string' || hexArr[i] instanceof Buffer))
                    this.vtx.push(this.app.orwell.TX.fromHEX(hexArr[i]));
                else if ((hexArr[i] instanceof Object))
                    this.vtx.push(this.app.orwell.TX.fromJSON(hexArr[i]));
            }
            return this;
        }
        updateMerkle() {
            let ids = [];
            for (let i in this.vtx) {
                if (this.vtx[i])
                    ids.push(this.vtx[i].getId())
            }

            return this.hashMerkleRoot = this.app.tools.merkleTree(ids);
        }
        getHash(format) {
            //new block
            if (!this.hash || format == 'raw') {

                if (!this.hashMerkleRoot)
                    this.updateMerkle();

                let header =
                    this.app.tools.littleEndian(this.version).toString('hex')
                    + this.app.tools.reverseBuffer(new Buffer(this.hashPrevBlock, 'hex')).toString('hex')
                    + this.app.tools.reverseBuffer(new Buffer(this.hashMerkleRoot, 'hex')).toString('hex')
                    + this.app.tools.littleEndian(this.time).toString('hex')
                    + this.app.tools.littleEndian(this.bits).toString('hex')
                    + this.app.tools.littleEndian(this.nonce).toString('hex'),
                    h = this.app.tools.reverseBuffer(this.app.orwell.hash(header));


                if (format == 'hex')
                    return this.hash = h.toString('hex');
                else
                    return h;
            } else {
                return this.hash;
            }
        }
        hashBytes() {

            if (!this.hashMerkleRoot)
                this.updateMerkle();

            let header =
                this.app.tools.littleEndian(this.version).toString('hex')
                + this.app.tools.reverseBuffer(new Buffer(this.hashPrevBlock, 'hex')).toString('hex')
                + this.app.tools.reverseBuffer(new Buffer(this.hashMerkleRoot, 'hex')).toString('hex')
                + this.app.tools.littleEndian(this.time).toString('hex')
                + this.app.tools.littleEndian(this.bits).toString('hex')
                + this.app.tools.littleEndian(this.nonce).toString('hex')

            return new Buffer(header, 'hex');
        }
        getFee() {
            //for all tx.getFee() ++
            let a = 0;
            for (let i in this.vtx) {
                a += this.vtx[i].getFee();
            }

            return a;
        }
        getHeaderHex() {
            return this.app.tools.bitPony.header.write(
                this.version,
                this.hashPrevBlock,
                this.hashMerkleRoot,
                this.time,
                this.bits,
                this.nonce).toString('hex');
        }
        toHex() {
            if (this.hex)
                return this.hex;

            let header =
                this.app.tools.littleEndian(this.version).toString('hex')
                + this.app.tools.reverseBuffer(new Buffer(this.hashPrevBlock, 'hex')).toString('hex')
                + this.app.tools.reverseBuffer(new Buffer(this.hashMerkleRoot, 'hex')).toString('hex')
                + this.app.tools.littleEndian(this.time).toString('hex')
                + this.app.tools.littleEndian(this.bits).toString('hex')
                + this.app.tools.littleEndian(this.nonce).toString('hex');

            let hexstr = this.app.tools.numHex(this.vtx.length);
            for (let i in this.vtx) {
                if (this.vtx[i])
                    hexstr += this.vtx[i].toHex()
            }

            return this.hex = header + hexstr;
        }
        toJSON() {
            let obj1 = {
                "hash": this.hash || this.getHash('hex'),
                "version": this.version,
                "prev": this.hashPrevBlock,
                "merkle": this.hashMerkleRoot ? this.hashMerkleRoot : this.updateMerkle(),
                "time": this.time,
                "bits": this.bits,
                "fee": this.getFee(),
                "nonce": this.nonce,
                "size": new Buffer(this.toHex(), 'hex').length,
                "height": this.height,
                "tx": [
                ]
            }

            if (this.confirmation)
                obj1.confirmation = this.confirmation;

            for (let i in this.vtx) {
                if (this.vtx[i])
                    obj1.tx.push(this.vtx[i].toJSON());
            }

            return obj1;
        }
        fromHex(hex) {

            let block = this.app.tools.bitPony.orwell_block.read(hex, true);
            this.setBlockHeader({
                version: block.header.version,
                prev: block.header.prev_block,
                hashMerkleRoot: block.header.merkle_root,
                time: block.header.timestamp,
                bits: block.header.bits,
                nonce: block.header.nonce,
            });

            for (let i in block.txns) {
                let t = ((txbody) => {
                    let t = new this.app.orwell.TX();
                    return t.fromHex(txbody)
                })(block.txns[i])
                this.vtx.push(t);

            }

            this.getHash('hex');

            return this;
        }
        fromJSON(json) {

            if (typeof json.bits == 'string')
                json.bits = parseInt(json.bits, 16);

            this.setBlockHeader({
                index: json.index,
                version: json.version,
                hashPrevBlock: json.hashPrevBlock || json.prev,
                hashMerkleRoot: json.hashMerkleRoot || json.merkle,
                time: json.time,
                bits: json.bits,
                nonce: json.nonce,
                height: json.height,
                hash: json.hash,
                height: json.height
            });

            for (let i in json.tx) {

                let t = this.app.orwell.TX.fromJSON(this.app, json.tx[i])
                this.vtx.push(t);

            }

            return this;

        }
        isValid(context) {
            //todo check block
            let val = new this.app.orwell.BLOCK.VALIDATOR(this, context);
            //var val = new blockvalidator(this);
            let res = val.isValid();
            if (!res)
                this.validation_errors = val.getErrors();

            return res;
        }
        send() {
            this.app.network.protocol.sendAll('block', this.toJSON());
        }
        static fromJSON(data) {
            if (data instanceof app.orwell.BLOCK)
                return data;

            let txlist = data.tx;
            let header = {
                "hash": data.hash,
                "version": data.version,
                "prev": data.prev,
                "merkle": data.merkle,
                "time": data.time,
                "bits": data.bits,
                "nonce": data.nonce,
                "height": data.height,
            };

            if (!txlist || !(txlist instanceof Array) || txlist.length < 1)
                app.throwErrorByCode('orwell', 'invalid_txlist')

            return new app.orwell.BLOCK(header, txlist);
        }
        static fromHEX(hex) {
            let block = new app.orwell.BLOCK({});
            block.fromHex(hex);
            return block;
        }
        static validate(block, context) {
            return block.isValid(context);
        }

        //orwell consensus methods:
        getId() {
            return this.hash;
        }
        getVersion() {
            return this.version;
        };
        getBits() {
            return this.bits;
        }
        getPrevId() {
            return this.hashPrevBlock;
        }
        getTime() {
            return this.time;
        }
        getKey() {//get public key of block (used for pos consensus, need sign coinbase block too)
            //key
        }
        getStakeValue(height) {
            //need key
            return 0;
        }
        isDelegateMessage() {
            //need key
            return 0;
        }
        isImportant() {
            return true;
        }
        emit() {
            app.emit("chain.data" + this.getId());
            if (this.vtx && this.vtx.length > 0)
                for (let i in this.vtx) {
                    if (this.vtx[i] && this.vtx[i].id)
                        app.emit("chain.data.tx" + this.vtx[i].getId());
                }
        }
        generate(cb) {
            this.updateMerkle()

            if (!this.hash) {
                this.app.pow.setOnIteration((nonce) => {
                    this.nonce = nonce;
                    return {
                        buffer: this.hashBytes(),
                        difficulty: this.bits
                    };
                })

                this.app.pow.startDig((nonce) => {
                    this.hash = this.app.pow.hash(this.hashBytes()).toString('hex')
                    cb(this);
                });
            }

            return {};
        }

        static generateNewBlockTemplate(timestamp, coinbaseBytes, keystore) {
            let mempool = app.orwell.getMemPool();
            let fee = 0;
            let txlist = [];
            for (let i in mempool) {
                fee += mempool[i].fee;
                txlist.push(mempool[i]);
            }

            let coinbase = app.orwell.TX.createCoinbase(fee, coinbaseBytes, [keystore.privateKey]);
            txlist.unshift(coinbase.toJSON());

            let latest = app.orwell.index.getTop();
            if (app.cnf('consensus').genesisMode)
                latest = { height: -1, id: '0000000000000000000000000000000000000000000000000000000000000000' };

            let diff = Math.ceil(app.orwell.getDiffForHeight(latest.height + 1));
            if (app.cnf('consensus').genesisMode)
                diff = 1;

            return {
                version: app.cnf("consensus").version,
                prev: latest.id,
                height: latest.height + 1,
                time: timestamp,
                bits: diff,
                tx: txlist
            };

        }

        static createNewBlock(coinbaseBytes, keystore) {
            if (!keystore)
                keystore = app.cnf('node');
            let now = parseInt(Date.now() / 1000);
            return app.orwell.BLOCK.generateNewBlockTemplate(now, coinbaseBytes, keystore);
        }

    }


    return block;
}