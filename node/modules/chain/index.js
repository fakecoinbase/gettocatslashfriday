
class chain {
    constructor(app) {
        this.BLOCK = require('./primitives/block')
        this.GENESIS = require('./primitives/genesis')
        this.TX = require('./primitives/tx')
        let indexClass = require('./indexer');
        this.index = new indexClass(app);

        this.app = app;
    }
    init() {
        this.app.setSyncState('loadFromCache');

        if (!this.loadBlocksFromFile()) {
            this.generateGenesisBlock();
        }
        //if not have in file - generate genesis
        //this need update from network

        //reindex blocks, save to storage
        //generate state
        this.index.create();
        this.app.state.createRaw(this.index.getLatest());
        this.app.setSyncState('readyToSync')
    }
    loadBlocksFromFile() {
        this.app.db.load('chain.json', 'blocks');
        this.app.db.load('mempool.json', 'mempool');
        this.initMemPool();
        this.updateLatestBlock();
        return this.app.db.get('latest').number >= 0;
    }
    initMemPool() {
        let list = this.app.db.get('mempool');
        if (!list || this.app.tools.emptyObject(list))
            list = [];
        let res = [];
        let now = Date.now() / 1000;
        for (let i in list) {
            if (this.app.cnf('consensus')['data.timeout'] > 0)
                if (list[i].timestamp + this.app.cnf('consensus')['data.timeout'] < now)
                    continue;

            res.push(list[i]);
        }

        this.app.db.mempool = res;
        this.app.db.save('mempool', 'mempool.json');
        return res;
    }
    generateGenesisBlock() {
        let tx = this.GENESIS.tx[0];
        let block = new this.BLOCK.fromJSON(this.app, this.GENESIS);
        //block.appendTx(this.TX.fromJSON(this.app, tx));

        let list = [block.toJSON()];
        this.app.db.set("blocks", list);
        this.app.db.save('blocks', 'chain.json');
        this.updateLatestBlock();
    }
    updateLatestBlock() {
        if (this.app.db.get('blocks').length > 0) {
            let b = {
                hash: this.app.db.get('blocks')[0].hash,
                number: this.app.db.get('blocks')[0].number
            }
            this.app.debug("info", "chain", "new top", b);
            this.app.db.set("latest", b);
            this.app.emit("app.chain.latest", b);
        }
    }
    getKnownRange() {
        let first = this.app.db.get('blocks')[0].number;
        let last = this.app.db.get('blocks')[this.app.db.get('blocks').length - 1].number;
        return [first, last];
    }
    inKnownRange(range) {
        const known = this.getKnownRange();
        return range[0] <= known[0] && range[1] >= known[1] && range[0] >= range[1];
    }
    getWindowRange(from) {
        if (!from)
            from = this.app.db.get('latest').number;
        let to = from - (this.app.cnf('pow').diffWindow + 2 * this.app.cnf('pow').diffCut);
        if (to < 0)
            to = 0;
        return [from, to];
    }
    getBlockList(numberFrom, numberTo) {
        const index = this.index.getLatest();
        let hash = index['block/number/' + numberFrom];
        if (!hash) {
            numberFrom -= 1;
            hash = index['block/number/' + (numberFrom)];
        }
        let hashTo = index['block/number/' + numberTo];
        let prevhash = index['block/prev/' + hash];
        let block = index['block/' + hash];
        if (hash == hashTo)
            return [block];


        let list = [block];
        do {
            hash = index['block/prev/' + hash];
            prevhash = index['block/prev/' + hash];
            block = index['block/' + hash];
            list.unshift(block);
        } while (hash != hashTo && hash != this.GENESIS.hash);

        return list;
    }
    getBlock(hash) {
        const index = this.index.getLatest();
        let block = index['block/' + hash];
        if (!block)
            throw new Error('block ' + hash + ' is not exist');
        return block;
    }
    getBlockNumber(hash) {
        const index = this.index.getLatest();
        let blockNumber = index['number/' + hash];
        if (!blockNumber && blockNumber != 0)
            throw new Error('block ' + hash + ' is not exist');
        return blockNumber;
    }
    getTimestampsWindow(from) {
        let range = this.getWindowRange(from);
        let blocks = this.getBlockList(range[0], range[1]);
        let timestamps = [];

        for (let i in blocks) {
            timestamps.push(blocks[i].timestamp);
        }

        //sort ?
        return timestamps.sort(function (a, b) {
            return a - b;
        });
    }
    getDifficultiesWindow(from) {
        let range = this.getWindowRange(from);
        let blocks = this.getBlockList(range[0], range[1]);
        let diffs = [];
        for (let i in blocks) {
            if (i == 0)
                diffs.push(1);
            else
                diffs.push(blocks[i].bits);
        }

        return diffs;
    }
    existHashInMemPool(hash) {
        let list = this.getMemPool();

        for (let i in list) {
            if (list[i].hash === hash)
                return true;
        }

        return false;
    }
    addToMemPool(obj, trigger) {
        let list = this.getMemPool();

        if (!obj.timestamp || obj.timestamp <= 0)
            this.app.throwError('Coinbase transaction can not be added in mempool', 'is-coinbase');

        if (!obj.hash || !obj.key || !obj.sign)
            this.app.throwError('Transaction is not valid', 'invalid-tx');

        let tx = this.TX.fromJSON(this.app, obj);
        let res = this.TX.validate(this.app, tx, { trigger: trigger });
        if (res.error || (res instanceof Array && res.length > 0)) {
            if (res instanceof Array) {
                let messages = [];
                let codes = [];
                for (let i in res) {
                    codes.push(res.code);
                    messages.push(res.message);
                }

                this.app.throwError('Transaction is not valid: ' + messages.join(", "), codes.join(","));
            } else
                this.app.throwError('Transaction is not valid: ' + res.message, res.code);
        }

        if (this.existHashInMemPool(obj.hash))
            this.app.throwError('This transaction already exist in mempool', 'alreadyexist');

        list.push(obj);
        this.app.db.set('mempool', list);
        let checkSum = new Buffer(tx.data, 'hex').slice(4, 8).toString('hex');
        this.app.emit("data" + checkSum, tx, checkSum);

        return true;
    }
    removeFromMemPool(hash) {
        let list = this.getMemPool();
        let finded = false;
        for (let i in list) {
            if (list[i].hash === hash) {
                list.splice(i, 1);
                finded = true;
                //return true;
            }
        }

        if (finded) {
            this.app.db.set('mempool', list);
            return true;
        }

        return false;

    }
    getMemPool() {
        let list = this.app.db.get('mempool');
        if (!list || this.app.tools.emptyObject(list))
            list = [];
        return list;
    }
    getBlockPool() {
        let list = this.app.db.get('blocks');
        if (!list || this.app.tools.emptyObject(list))
            list = [];
        return list;
    }
    existBlock(hash) {
        let list = this.getBlockPool();

        for (let i in list) {
            if (list[i].hash === hash)
                return true;
        }

        return false;
    }
    addBlock(obj, trigger, context) {
        if (!context)
            context = {};
        let list = this.getBlockPool();

        context.trigger = trigger;
        if (this.existBlock(obj.hash))
            this.app.throwError('This block already exist', 'alreadyexist');

        this.app.debug('info', 'chain', 'validate block ' + obj.hash)
        let block = this.BLOCK.fromJSON(this.app, obj);
        let res = this.BLOCK.validate(this.app, block, context);
        if (res.error)
            this.app.throwError('Block is not valid: ' + res.message, res.code);

        this.app.debug('info', 'chain', 'valid block ' + obj.hash)
        list.unshift(obj);
        this.app.db.set('blocks', list);
        this.app.db.save('blocks', 'chain.json');
        this.index.update(block);
        this.app.state.createRaw(this.index.getLatest());
        this.updateLatestBlock();

        for (let i in block.tx) {
            this.removeFromMemPool(block.tx[i].hash)
            this.app.emit("tx.confirmed." + block.tx[i].hash, block.tx[i], block.hash);
        }

        return block;
    }
    sendBlock(blockInfo) {
        if (blockInfo instanceof this.BLOCK)
            blockInfo = blockInfo.toJSON();
        this.app.network.protocol.sendAll('block', blockInfo);
    }
    sendTx(txInfo) {
        if (txInfo instanceof this.TX)
            txInfo = txInfo.toJSON();
        this.app.network.protocol.sendAll('mempool.tx', txInfo);
    }
    sendDataFromKeystore(keystore, value) {
        let tx = this.app.chain.TX.create(this.app, value, keystore);
        this.sendTx(tx);
        return tx;
    }
    sendData(value, accountName) {
        let tx;
        if (accountName.privateKey)
            tx = this.app.chain.TX.create(this.app, value, accountName);
        else
            tx = this.app.chain.TX.create(this.app, value, this.app.wallet.findAddrByAccount(accountName || "0"));
        this.sendTx(tx);
        return tx;
    }
    sendEncryptedData(publicKey, value, keystoreOrAccountName) {
        let keystore;
        if (keystoreOrAccountName instanceof String)
            keystore = this.app.wallet.findAddrByAccount(keystoreOrAccountName);
        else
            keystore = keystoreOrAccountName;

        //create ecdh X | publicKey, keystore -> X
        let X = this.app.crypto.createECDHsecret(publicKey, keystore);
        //encrypt value with | X, value -> encvalue
        let encryptedBuffer = this.app.crypto.encryptECDH(value, X).toString('hex');
        let controlBytes = this.app.crypto.sha256(new Buffer(publicKey, 'hex')).slice(0, 4).toString("hex")
        let messageParams = "01000000";
        let data = messageParams + controlBytes + encryptedBuffer;
        //createTx | encvalue, keystore -> tx
        let tx = this.app.chain.TX.create(this.app, data, keystore);
        //sendTx | tx 
        this.sendTx(tx);
        return tx;
    }

}

module.exports = chain;