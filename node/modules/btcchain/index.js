const crypto = require('crypto');

class chain {

    constructor(app) {
        //this.BLOCK = require('./primitives/block')
        //this.GENESIS = require('./primitives/genesis')
        //this.TX = require('./primitives/tx')
        //let indexClass = require('./indexer');
        //this.index = new indexClass(app);

        this.errors = {
            'not_tx_obj': [-101, 'Invalid tx object'],
            'invalid_txlist': [-201, 'Invalid txlist format for block json data']
        }

        this.app = app;
        this.hash = (bufferOrString) => {
            return crypto.createHash('sha256').update(crypto.createHash('sha256').update(new Buffer(bufferOrString, 'hex')).digest()).digest();
            //return this.app.crypto.sha256(this.app.crypto.sha256(new Buffer(bufferOrString, 'hex')));
        }

        this.GENESIS = this.app.cnf("genesis");
        this.ADDRESS = require('./primitives/address');
        this.SCRIPT = require('./primitives/script');
        this.TX = require('./primitives/tx');
        this.BLOCK = require('./primitives/block');
        this.BLOCK.VALIDATOR = require('./primitives/block/validator')(app);
        let bp = require('./primitives/blockpool');

        this.prepare();

        if (this.app.cnf('debug').indexing)
            this.app.debug("info", "btcchain", "storage loaded, can load indexes")
        //this entity can be loaded after db initialization.
        let BLOCKPOOL = bp(app);
        let inds = require('./indexer');
        let utxo_ = require('./utxo');
        let MiningWork = require('./work')(app);
        let index = inds(app);
        let UTXO = utxo_(app);

        this.blockpool = new BLOCKPOOL();
        this.index = new index();
        this.utxo = new UTXO();

        this.miningWork = new MiningWork();

    }
    prepare() {

        this.BLOCK.VALIDATOR.addRule('', function (validator, context, app) {
            let block = this;

            //app.throwError("msg", 'code');
            return true;
        });


        this.app.tools.bitPony.extend('orwell_block', () => {//datascript...

            return {
                read: (buffer, rawTx) => {
                    if (typeof buffer == 'string')
                        buffer = new Buffer(buffer, 'hex')

                    if (buffer.length == 0 || !buffer)
                        buffer = new Buffer([0x0]);

                    let offset = 0, stream = new this.app.tools.bitPony.reader(buffer);
                    let block = {}
                    let res = stream.header(offset);
                    offset = res.offset;
                    block.header = res.result;

                    let tx = [];

                    for (let i = 0; i < block.header.txn_count; i++) {

                        let startoffset = offset;
                        res = stream.tx(offset);
                        offset = res.offset;
                        let tx_item;
                        let dsstart = offset;

                        if (buffer[offset] == 0xef) {//have datascript array
                            res = stream.var_int(offset + 1)
                            offset = res.offset;
                            let script_cnt = res.result;
                            let scripts = [];
                            for (let k = 0; k < script_cnt; k++) {
                                res = stream.string(offset);
                                offset = res.offset;
                                scripts.push(res.result)
                            }
                        } else if (buffer[offset] == 0xee) {//have datascript
                            res = stream.uint8(offset + 1);
                            offset = res.offset;
                            res = stream.string(offset);
                            offset = res.offset;
                            res = stream.string(offset);
                            offset = res.offset;
                        }

                        if (offset > dsstart && !rawTx)
                            tx_item.datascript = buffer.slice(dsstart, offset).toString('hex');

                        if (rawTx)
                            tx_item = buffer.slice(startoffset, offset).toString('hex');

                        tx.push(tx_item)
                    }

                    block.txn_count = tx.length;
                    block.txns = tx;
                    return block

                },
                write: (block) => {

                    let header = this.app.tools.bitPony.header.write(block.version, block.prev_block || block.hashPrevBlock, block.merkle_root || block.hashMerkleRoot || block.merkle, block.time, block.bits, block.nonce);
                    let length = this.app.tools.bitPony.var_int(block.vtx.length);
                    let txlist = new Buffer('');

                    for (let i in block.vtx) {
                        txlist += new Buffer(block.vtx[i].toHex(), 'hex');
                    }

                    return Buffer.concat([
                        header,
                        length,
                        txlist
                    ])

                }
            }

        });
    }
    init() {
        return new Promise((res) => {
            this.app.setSyncState('loadFromCache');

            if (!this.loadBlocksFromFile()) {
                this.generateGenesisBlock();
            }
            //if not have in file - generate genesis
            //this need update from network

            //reindex blocks, save to storage
            this.app.setSyncState('readyToSync')
            res();

            require('./rpc.methods')(this.app);
            this.app.rpc.start();

        });
    }
    loadBlocksFromFile() {
        this.sync();
        this.initMemPool();
        this.updateLatestBlock();
        return this.index.get('top').height >= 0;
    }
    sync() {

        if (this.app.cnf("consensus").genesisMode)
            this.blockpool.clear();

        let commonCnt = this.blockpool.blockCount(), m = 0;

        if (this.app.cnf('debug').blockchain_sync)
            this.app.debug("info", "btcchain", "blockchain local sync: finded " + commonCnt + " records, reading:");

        let offset = 0, cnt = 1000, blocks = [];
        let arr = this.blockpool.loadBlocks(commonCnt);//asc//todo, fix limit,offset

        for (let i in arr) {
            if (arr[i]) {
                let b = this.BLOCK.fromJSON(this.app, arr[i]);
                blocks.push(b);
                m++;

                if (this.app.cnf('debug').blockchain_sync)
                    this.app.debug("info", "btcchain", "blockchain local sync: " + (parseInt((m / commonCnt) * 100)) + "%");
            }
        }

        if (this.app.cnf('debug').blockchain_sync)
            this.app.debug("info", "btcchain", "blockchain local sync: 100%");

        if (!Object.keys(blocks).length && !this.app.cnf("consensus").genesisMode) {
            let gen = new this.BLOCK(this.app, this.GENESIS.header, this.GENESIS.txlist);
            let b = this.blockpool.get(gen.getHash('hex'));
            if (!b || !b.hash) {
                this.index.updateTop({ hash: gen.hash, height: 0 });
                gen.height = gen.index = 0;
                gen.genesis = 1;
                blocks.push(gen);
                this.appendBlock(gen, 1);
            }
        }


        this.indexBlocks(blocks);
    }
    appendBlock(block, isgenesis, cb) {
        if (!block instanceof this.BLOCK)
            throw new Error('block object must be instanceof Block class to appending in Blockchain');

        let b = false;
        try {
            b = this.getBlock(block.hash);
            block.validation_errors = [];
            block.validation_errors.push('duplicate');
        } catch (e) {

        }
        if (b && b.hash) {
            if (cb instanceof Function)
                cb(block, 1, 1);
            return;
        }

        let prevblockinfo = this.index.get("block/" + block.hashPrevBlock);
        let blockvalid = block.isValid()

        if (block.hash == this.GENESIS.header.hash)
            isgenesis = 1;

        let inMainChain = 0;
        if (blockvalid && !isgenesis) {
            let top = this.index.get('top').hash;
            this.indexBlock(block, { height: prevblockinfo.height + 1, events: this.action == 'seek' });

            block.height = prevblockinfo.height + 1;
            if (block.hashPrevBlock == top) {
                this.index.updateTop({
                    hash: block.hash,
                    height: prevblockinfo.height + 1
                });

            }

            inMainChain = 1;
            this.blockpool.save(block.toJSON());
        } else if (isgenesis) {
            this.index.setContext(0)
            this.indexBlock(block, { height: 0, events: false });
            this.index.setContext(null)

            this.index.updateTop({
                hash: block.hash,
                height: 0
            });

            inMainChain = 1;
            this.blockpool.save(block.toJSON());
        }

        if (cb instanceof Function)
            cb(block, 0, inMainChain);
    }
    indexBlock(block, context) {
        let b = block.toJSON();
        for (let i in b.tx) {
            let tx = b.tx[i];
            this.index.set("tx/" + tx.hash, { block: b.hash, index: i });
            if (tx.hash) {
                this.utxo.addTx(tx);

                if (i != 0 && tx.coinbase)
                    throw new Error('coinbase tx can not be not first in list of block tx');//resync or maybe something like this

                if (i == 0 && tx.coinbase) {//so.. havent inputs
                    let out = tx.out[0];
                    this.addOutIndex({
                        type: 'input',
                        hash: tx.hash,
                        address: out.address,
                        amount: out.amount,
                        events: context.events
                    });
                } else {
                    for (let o in tx.out) {
                        let out = tx.out[o];
                        this.addOutIndex({
                            type: 'input',
                            index: o,
                            hash: tx.hash,
                            address: out.address,
                            amount: out.amount,
                            events: context.events
                        });
                    }

                    for (let inp in tx.in) {
                        let inpt = tx.in[inp];
                        let prevout = this.getOut(inpt.hash, inpt.index);
                        if (prevout !== false)
                            this.addOutIndex({
                                type: 'output',
                                hash: tx.hash,
                                index: inp,
                                address: prevout.address,
                                amount: prevout.amount,
                                events: context.events
                            });
                    }

                    if (tx.datascript) {
                        this.addDSIndex({ hash: tx.hash, out: tx.out[0], events: context.events })
                    }

                    //TODO: remove from mempool
                    //var mempool = require('../db/entity/tx/pool')
                    //mempool.removeTx(tx.hash)
                }


            }
        }

        this.index.set("index/" + context.height, b.hash);
        this.index.set("prev/" + b.hash, b.hashPrevBlock);
        this.index.set("time/" + b.hash, b.time);
        this.index.set("block/" + b.hash, {
            prev: b.hashPrevBlock,
            height: context.height
        });
    }
    indexBlocks(blocks) {
        let last = 0, dbheight = 0, m = 0, commonCnt = blocks.length, synced = false;

        if (this.app.cnf('debug').indexing)
            this.app.debug("info", "btcchain", "blockchain indexing: started");

        if (blocks.length > 0)
            if (this.index.get('top').hash == blocks[blocks.length - 1].hash)
                synced = true;

        if (blocks.length <= 0)
            synced = true;

        if (synced) {
            if (this.app.cnf('debug').indexing)
                this.app.debug("info", "btcchain", "blockchain indexing: already synced");
        } else {
            for (let i in blocks) {
                let b = blocks[i];

                if (!b)
                    continue;

                if (!(b instanceof this.BLOCK)) {
                    let b1 = new this.BLOCK(this.app);
                    b = b1.fromJSON(b);
                }

                if (this.app.cnf('debug').indexing && m % 100 == 0)
                    this.app.debug("info", "btcchain", "blockchain indexing: " + (parseInt((m / commonCnt) * 100)) + "%");

                this.index.setContext(dbheight);
                this.indexBlock(b, { height: dbheight, events: false, state: 'sync' }, false);
                this.index.setContext(null);

                //todo add txHash -> block hash to find tx fast
                last = b.getHash('hex');
                dbheight++;
                m++;
            }

            if (this.app.cnf('debug').indexing)
                this.app.debug("info", "btcchain", "blockchain indexing: done. head block: " + last + ", height: " + (dbheight - 1));

            if (last)
                this.index.updateTop({
                    hash: last,
                    height: dbheight - 1,
                })
        }
    }
    getBlock(hash) {
        let block = this.blockpool.getBlock(hash)
        if (block.hash) {
            delete block.meta
            delete block.$loki;
            block.confirmation = this.index.get('top').height - block.height + 1;
        }

        return block;
    }
    getTx(hash) {
        let txk = this.index.get("tx/" + hash);

        if (txk) {
            let b = this.getBlock(txk.block);
            let tx = b.tx[txk.index];
            tx.confirmation = this.index.get('top').height - b.height + 1;
            tx.fromBlock = b.hash;
            tx.fromIndex = txk.index;
            tx.time = b.time;
            return tx;
        } else {
            throw new Error('can not find tx ' + hash);
            //do inv with this hash
            //return null;
        }

    }
    getOut(hash, index_cnt) {
        if (hash == "0000000000000000000000000000000000000000000000000000000000000000" && index_cnt == 0xffffffff)
            return false;
        let tx = this.getTx(hash);
        return tx.out[index_cnt];
    }
    addOutIndex(data) {
        if (this.app.cnf('debug').blockchain_sync)
            this.app.debug("info", "btcchain", "add index " + data.address, data.hash, data.amount)

        let addrind = this.index.get("address/" + data.address);
        if (!addrind || !(addrind instanceof Array))
            addrind = [];

        let finded = 0;
        for (let i in addrind) {
            let _inx = addrind[i];
            if (_inx == data.hash && _inx.index == data.index) {
                finded = 1;
                break;
            }
        }

        if (finded)
            return addrind;

        let obj = {
            type: data.type, //input||output
            tx: data.hash,
            amount: data.amount
        };
        addrind.push(obj);

        if (data.events) {
            obj.address = data.address;
            app.emit("chain.event.address", obj)
        }

        this.index.set("address/" + data.address, addrind)
        return addrind
    }
    addDSIndex(context) {
        context.out.address = this.SCRIPT.scriptToAddr(context.out.scriptPubKey);
        context.out.addrHash = this.SCRIPT.scriptToAddrHash(context.out.scriptPubKey).toString('hex');

        if (this.app.cnf('debug').indexing)
            this.app.debug("info", "btcchain", "add ds index " + context.out.addrHash, context.hash);

        let addrind = this.index.get("ds/address/" + context.out.addrHash);
        if (!addrind || !(addrind instanceof Array))
            addrind = [];

        addrind.push(context.hash);

        if (context.events) {
            this.app.emit("chain.event.ds", {
                address: context.out.addrHash,
                txid: context.hash
            })
        }

        this.index.set("ds/address/" + context.out.addrHash, addrind)
        return addrind
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
        let tx = this.GENESIS.txlist;
        let data = this.GENESIS.header;
        data.tx = tx;

        let block = this.BLOCK.fromJSON(this.app, data);
        this.blockpool.clear();

        this.blockpool.save(block.toJSON());

        this.updateLatestBlock();
    }
    updateLatestBlock() {
        if (this.blockpool.blockCount() > 0) {
            let latest = this.blockpool.getLastBlock();
            let b = {
                hash: latest.hash,
                height: latest.height || 0
            }
            this.app.debug("info", "btcchain", "new top", b);
            this.index.updateTop(b);
            this.app.emit("app.btcchain.latest", b);
        }
    }
    getKnownRange() {
        let first = this.blockpool.getLastBlock().index || 0;
        let last = this.blockpool.getFirstBlock().index || 0;
        return [first, last];
    }
    inKnownRange(range) {
        const known = this.getKnownRange();
        return range[0] <= known[0] && range[1] >= known[1] && range[0] >= range[1];
    }
    getWindowRange(from) {
        if (!from)
            from = this.index.getTop().height;
        let to = from - (this.app.cnf('pow').diffWindow + 2 * this.app.cnf('pow').diffCut);
        if (to < 0)
            to = 0;
        return [from, to];
    }
    getBlockList(numberFrom, numberTo) {
        let hash = this.index.get('index/' + numberFrom);
        if (!hash) {
            numberFrom -= 1;
            hash = this.index.get('index/' + (numberFrom));
        }

        if (numberTo < 0)
            numberTo = 0;
        let hashTo = this.index.get('index/' + numberTo);
        let prevhash = this.index.get('block/' + hash).prev;

        let block = this.getBlock(hash);
        if (hash == hashTo)
            return [block];


        let list = [block];
        do {
            hash = this.index.get('block/' + hash).prev;
            prevhash = this.index.get('block/' + hash).prev;
            block = this.getBlock(hash);
            list.unshift(block);
        } while (hash != hashTo && hash != this.GENESIS.header.hash);

        return list;
    }
    getBlockNumber(hash) {
        let blockNumber = this.index.get('index/' + hash);
        if (!blockNumber && blockNumber != 0)
            throw new Error('block ' + hash + ' is not exist');
        return blockNumber;
    }
    getCount() {
        return this.blockpool.blockCount();
    }
    getTimestampsWindow(from) {
        let range = this.getWindowRange(from);
        let blocks = this.getBlockList(range[0], range[1]);
        let timestamps = [];

        for (let i in blocks) {
            timestamps.push(blocks[i].timestamp);
        }
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
    getActualDiff() {
        let last_inx = this.index.get('top').height;
        let first_inx = last_inx - this.app.cnf("btcpow").blockcount;
        if (first_inx < 0)
            first_inx = 0;

        let list = this.getBlockList(last_inx, first_inx)//one hour
        let first = list[list.length - 1];
        let last = list[0];
        //console.log(first.height, last.height, last.time - first.time);

        if (last.height < this.app.cnf("btcpow").premine)
            return parseInt(this.app.cnf("btcpow").maxtarget, 16);

        if (!list.length || list.height == 0)//genesis check
            return parseInt(this.app.cnf("btcpow").maxtarget, 16);

        // Limit adjustment step
        let nActualTimespan = last.time - first.time;
        return this.app.pow.getBitsRange(nActualTimespan, last);
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
        return this.blockpool;
    }
    existBlock(hash) {
        try {
            let item = this.blockpool.getBlock(hash);

            if (item && item.hash)
                return true;
        } catch (e) {

        }

        return false;
    }
    addBlock(obj, trigger, context, cb) {
        if (!context)
            context = {};

        context.trigger = trigger;
        if (this.existBlock(obj.hash))
            this.app.throwError('This block already exist', 'alreadyexist');

        this.app.debug('info', 'btcchain', 'validate block ' + obj.hash)
        let block;

        if (obj instanceof this.BLOCK)
            block = obj;
        else
            block = this.BLOCK.fromJSON(this.app, obj);

        let res = this.BLOCK.validate(block, context);
        if (!res[0])
            this.app.throwError('Block is not valid: ' + res[1].join(", "), res[1].join(", "));

        this.app.debug('info', 'btcchain', 'valid block ' + obj.hash)
        if (!(cb instanceof Function))
            cb = function () { };
        this.appendBlock(block, 0, cb);
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