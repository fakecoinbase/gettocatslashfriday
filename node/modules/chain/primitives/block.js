const bitPony = require('bitpony');
let Rules = require('./block.rules');

class BLOCK {

    constructor(app, data, type) {
        this.app = app;
        this.tx = [];
        this.type = type;

        this.hash = data.hash;
        this.version = data.version;
        this.prevblock = data.prevblock;
        this.number = data.number;
        this.timestamp = data.timestamp;
        this.merkle = data.merkle;
        this.bits = data.bits;
        this.nonce = data.nonce || 0;

        this.f_onReady = function () { };
    }
    build() {
        this.generateMerkle()
        this.buildHeader();
        this.generateValidHash();
    }
    generateMerkle() {

        let txhashes = [];
        for (let i in this.tx) {
            txhashes.push(this.tx[i].hash);
        }

        return this.merkle = this.app.tools.merkleTree(txhashes);
    }
    buildHeader() {
        let stream = new bitPony.writer();
        stream.var_int(this.version, true);
        stream.char(new Buffer(this.prevblock, 'hex'), true);
        stream.var_int(this.number, true);
        stream.var_int(this.timestamp, true);
        stream.char(new Buffer(this.merkle, 'hex'), true);
        stream.var_int(this.bits, true);
        stream.var_int(this.nonce, true);

        return this.header = stream.getBuffer();

    }
    generateValidHash() {
        if (!this.hash) {
            this.app.pow.setOnIteration((nonce) => {
                this.nonce = nonce;
                return {
                    buffer: this.buildHeader(),
                    difficulty: this.bits
                };
            })

            this.app.pow.startDig((nonce) => {
                this.hash = this.app.pow.hash(this.buildHeader()).toString('hex')
                this.f_onReady.apply(this);
            });
        }

        return {};
    }
    onReady(f) {
        this.f_onReady = f;
    }
    haveTx(hash) {
        for (let i in this.tx) {
            if (this.tx[i].hash == hash)
                return true;
        }

        return false;
    }
    appendTx(tx) {
        if (!this.haveTx(tx.hash))
            this.tx.push(tx);
    }
    toJSON() {
        let txlist = [];
        for (let i in this.tx) {
            txlist.push(this.tx[i].toJSON());
        }

        return {
            hash: this.hash,
            version: this.version,
            prevblock: this.prevblock,
            number: this.number,
            timestamp: this.timestamp,
            merkle: this.merkle,
            bits: this.bits,
            nonce: this.nonce,
            tx: txlist
        }
    }
}

BLOCK.generate = function (app, data, txlist) {

    return new Promise((res) => {
        let b = new BLOCK(app, data, 'create');
        for (let i in txlist) {
            b.appendTx(txlist[i]);
        }
        b.onReady(function () {
            res(b);
        });
        b.build();
    });

}

BLOCK.fromJSON = function (app, data) {
    let b = new BLOCK(app, data, 'load');
    if (data.tx && data.tx.length > 0)
        for (let i in data.tx) {
            b.appendTx(app.chain.TX.fromJSON(app, data.tx[i]))
        }

    return b;
}

BLOCK.toJSON = function (block) {
    return block.toJSON();
}

BLOCK.generateNewBlockTemplate = function (app, timestamp, coinbaseJSON) {

    let mempool = app.chain.getMemPool();
    let txlist = [coinbaseJSON];
    for (let i in mempool){
        txlist.push(mempool[i]);
    }
    let latest = app.db.get("latest");
    let diff = app.pow.next_diff(app.chain.getTimestampsWindow(), app.chain.getDifficultiesWindow(), app.cnf('pow').target);

    return {
        version: app.cnf("consensus").version,
        prevblock: latest.hash,
        number: latest.number + 1,
        timestamp: timestamp,
        bits: diff,
        tx: txlist
    };

}

BLOCK.createNewBlock = function (app) {
    let now = parseInt(Date.now() / 1000);
    let coinbase = app.chain.TX.createCoinbase(app,
        app.cnf("agent").name + ":" + app.cnf("agent").version + "/" + (now)
    );

    let block = BLOCK.generateNewBlockTemplate(app, now, coinbase.toJSON());
    let txlist = block.tx;
    delete block.tx;
    return {
        header: block,
        txlist: txlist
    };
}

BLOCK.validate = function (app, block, context) {
    //context.trigger - sync|mining|relay - sync - block syncing validation, mining - new block from miner, relay - new block from network
    //valid time
    if (block.hash != app.chain.GENESIS.hash) {
        const week = 7 * 24 * 60 * 60;
        if ((block.timestamp <= 0) || block.timestamp > (Date.now() / 1000 + week))
            return { error: true, message: 'Invalid timestamp of block ' + block.hash, code: 'invalid-timestamp' };
    }

    //valid hash
    let genhash = app.pow.hash(block.buildHeader()).toString('hex');
    if (genhash != block.hash)
        return { error: true, message: 'Block hash is not valid for ' + block.hash, code: 'invalid-hash' };

    if (!context.isWindowFirst) {//sync state, we pull block window, and its first from window.
        //prevblock check n blockchain
        //todo: in sync validation: old block can not have prevblock. Need check window, and id its window.oldest - its okay.
        try {
            app.chain.getBlock(block.prevblock);
        } catch (e) {
            return { error: true, message: 'PrevBlock hash is not valid for ' + block.prevblock + " + " + e.message, code: 'invalid-prevblock' };
        }
        //number - check exists (number-1 === prevblock)
        let number = 0;
        try {
            number = app.chain.getBlockNumber(block.prevblock);
        } catch (e) {
            return { error: true, message: 'PrevBlock hash is not valid for ' + block.prevblock, code: 'invalid-prevblock' };
        }

        if (!(number + 1 == block.number))
            return { error: true, message: 'Block number is not valid for ' + block.hash, code: 'invalid-number' };
    }

    let cntCoinbase = 0;
    for (let i in block.tx) {
        if (!block.tx[i].timestamp)
            cntCoinbase++;
    }

    if (cntCoinbase > 1) {
        return { error: true, message: 'Multiple coinbase is not supported, block ' + block.hash, code: 'multiple-coinbase' };
    }

    //check merkle
    let txhashes = [];
    for (let i in block.tx) {
        txhashes.push(block.tx[i].hash);
    }

    let merkle = app.tools.merkleTree(txhashes);
    if (merkle != block.merkle)
        return { error: true, message: 'Block merkle is not valid for ' + block.hash, code: 'invalid-merkle' };

    //check bits
    if (app.cnf('consensus').algo == 'pow') {
        let nh = new app.pow.BN(block.hash);
        if (!app.pow.lt(block.hash, block.bits)) {
            return { error: true, message: 'Block bits is not valid for ' + block.hash, code: 'invalid-difficulty-calculation' };
        }
    }

    //check next_diff for this block
    if (context.syncNum > app.cnf('pow').diffWindow + 2 * app.cnf('pow').diffCut + 10)
        if (app.chain.inKnownRange(app.chain.getWindowRange(block.number - 1))) {
            let diff = app.pow.next_diff(app.chain.getTimestampsWindow(block.number - 1), app.chain.getDifficultiesWindow(block.number - 1), app.cnf('pow').target);
            if (diff != block.bits)
                return { error: true, message: 'Block diff is not valid for ' + block.hash, code: 'invalid-difficulty-value' };
        }

    //check tx list
    let txerrors = [];
    for (let i in block.tx) {
        let res = app.chain.TX.validate(app, block.tx[i], i == 0 ? 'coinbase' : 'common', {
            trigger: 'blockvalidate',
            parent: context
        });
        if (res.error)
            txerrors.push(res);
    }

    if (txerrors.length)
        return txerrors;

    let errors = Rules.check(block, context);
    if (!errors.length) {
        return { error: false };
    } else
        return errors;
}

BLOCK.rules = Rules;
module.exports = BLOCK;