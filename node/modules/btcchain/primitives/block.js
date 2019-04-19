class block {

    constructor(app, header, txList) {
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
        this.hashPrevBlock = header.hashPrevBlock;
        this.hashMerkleRoot = header.hashMerkleRoot;
        this.time = header.time;
        this.bits = header.bits;
        this.nonce = header.nonce;
        this.index = this.height = header.height;
        if (header.hash)
            this.hash = header.hash;
    }
    getBlockHeader() {
        let h = {};
        h.version = this.version;
        h.hashPrevBlock = this.hashPrevBlock;
        h.hashMerkleRoot = this.hashMerkleRoot
        h.time = this.time;
        h.bits = this.bits;
        h.nonce = this.nonce;
        h.index = h.height = this.height
        return h;
    }
    addTxFromHEX(hex) {
        let t = new this.app.btcchain.TX.fromHEX(this.app, hex);
        this.vtx.push(t);
        return this;
    }
    addTxFromJSON(json) {
        let t = new this.app.btcchain.TX.fromJSON(this.app, json);
        this.vtx.push(t);
        return this;
    }
    addTx(tx) {
        if (!(tx instanceof this.app.btcchain.TX))
            this.app.throwErrorByCode('btcchain', 'not_tx_obj');
        this.vtx.push(tx);
        return this;
    }
    addTxList(hexArr) {
        for (let i in hexArr) {
            if (hexArr[i] instanceof this.app.btcchain.TX)
                this.vtx.push(hexArr[i])
            else if ((typeof hexArr[i] === 'string' || hexArr[i] instanceof Buffer))
                this.vtx.push(this.app.btcchain.TX.fromHEX(this.app, hexArr[i]));
            else if ((hexArr[i] instanceof Object))
                this.vtx.push(this.app.btcchain.TX.fromJSON(this.app, hexArr[i]));
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
                h = this.app.tools.reverseBuffer(this.app.btcchain.hash(header));


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
            "hashPrevBlock": this.hashPrevBlock,
            "hashMerkleRoot": this.hashMerkleRoot ? this.hashMerkleRoot : this.updateMerkle(),
            "time": this.time,
            "bits": this.bits,
            "fee": this.getFee(),
            "nonce": this.nonce,
            "n_tx": this.vtx.length,
            "size": new Buffer(this.toHex(), 'hex').length,
            "height": this.height,
            "tx": [
            ]
        }

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
            hashPrevBlock: block.header.prev_block,
            hashMerkleRoot: block.header.merkle_root,
            time: block.header.timestamp,
            bits: block.header.bits,
            nonce: block.header.nonce,
        });

        this.getHash('hex');
        for (let i in block.txns) {
            let t = ((txbody) => {
                let t = new this.app.btcchain.TX(this.app);
                return t.fromHex(txbody)
            })(block.txns[i])
            this.vtx.push(t);

        }

        return this;
    }
    fromJSON(json) {

        if (typeof json.bits == 'string')
            json.bits = parseInt(json.bits, 16);

        this.setBlockHeader({
            index: json.index,
            version: json.version,
            hashPrevBlock: json.hashPrevBlock,
            hashMerkleRoot: json.hashMerkleRoot,
            time: json.time,
            bits: json.bits,
            nonce: json.nonce,
            height: json.height,
            hash: json.hash,
        });

        for (let i in json.tx) {

            let t = this.app.btcchain.TX.fromJSON(this.app, json.tx[i])
            this.vtx.push(t);

        }

        return this;

    }
    isValid(context) {
        //todo check block
        let val = new this.app.btcchain.BLOCK.VALIDATOR(this, context);
        //var val = new blockvalidator(this);
        let res = val.isValid();
        if (!res[0])
            this.validation_errors = res[1];

        return res;
    }
    send() {
        //todo
    }
    static fromJSON(app, data) {
        let txlist = data.tx;
        delete data.tx;
        let header = data;

        if (!txlist || !(txlist instanceof Array) || txlist.length < 1)
            app.throwErrorByCode('btcchain', 'invalid_txlist')

        return new app.btcchain.BLOCK(app, header, txlist);
    }
    static fromHEX(app, hex) {
        let block = new app.btcchain.BLOCK(app, {});
        block.fromHex(hex);
        return block;
    }
    static validate(block, context) {
        return block.isValid(context);
    }
}

module.exports = block;