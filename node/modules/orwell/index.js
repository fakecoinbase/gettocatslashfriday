const crypto = require('crypto');
const BN = require('bn.js');

class orwell {

    constructor(app) {

        //this.app.throwErrorByCode('orwell', 'not_tx_obj');
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
        this.ADDRESS = require('./primitives/address')(app);
        this.SCRIPT = require('./primitives/script')(app);
        this.TX = require('./primitives/tx')(app);
        this.BLOCK = require('./primitives/block')(app);
        this.BLOCK.VALIDATOR = require('./primitives/block/validator')(app);
        this.TX.VALIDATOR = require('./primitives/tx/validator')(app);

        //this entity can be loaded after db initialization.
        let BLOCKPOOL = require('./primitives/blockpool')(app);
        let MEMPOOL = require('./mempool')(app);
        let ORPHAN = require('./primitives/orphanpool')(app);
        let SIDE = require('./primitives/sidepool')(app);
        let index = require('./indexer')(app);
        let UTXO = require('./utxo')(app);
        let DSINDEX = require('./dsindex')(app);
        let MiningWork = require('./work')(app);

        this.prepare();
        if (this.app.cnf('debug').indexing)
            this.app.debug("info", "orwell", "storage loaded, can load indexes");

        this.blockpool = new BLOCKPOOL();
        this.mempool = new MEMPOOL();
        this.orphanpool = new ORPHAN();
        this.sidepool = new SIDE();
        this.index = new index();
        this.utxo = new UTXO();
        this.dsIndex = new DSINDEX();
        this.miningWork = new MiningWork();
        this.checkpoint = require("./checkpoints");
        this.consensus = require("./consensus")(app, this);
        this.OVM = require("./orwellvm")(app);
    }
    prepare() {

        require('./validations')(this.app, this);

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
                        let tx_item = res.result;
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
                        } else if (buffer[offset] == 0xcb && buffer[offset + 1] == 0xae) {//coinbase info
                            tx_item.datascript = "";

                            let endoffset = 0;
                            res = stream.string(offset + 2);
                            endoffset += res.offset - offset;
                            offset = res.offset;
                            res = stream.string(offset);
                            endoffset += res.offset - offset;
                            offset = res.offset;
                            res = stream.uint32(offset);
                            endoffset += res.offset - offset;
                            offset = res.offset;
                            res = stream.var_int(offset);
                            endoffset += res.offset - offset;
                            offset = res.offset;

                            offset += res.result;
                            endoffset += res.result;//bytes array next

                            tx_item.in[0].coinbase = buffer.slice(dsstart + 2, offset).toString('hex');
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

            /*if (!this.loadBlocksFromFile()) {
                this.generateGenesisBlock();
            }*/
            //if not have in file - generate genesis
            //this need update from network

            //reindex blocks, save to storage

            let promise = Promise.resolve();
            if (!this.app.cnf("consensus").genesisMode)
                if (this.needReindex()) {
                    promise = this.reindexLocal();
                }

            promise
                .then(() => {
                    this.app.setSyncState('readyToSync')

                    if (this.app.cnf('rpc').useServer) {
                        require('./rpc.methods')(this.app);
                        this.app.rpc.start();
                    }

                    res();
                });
        });
    }

    needReindex() {
        let cnt = this.blockpool.blockCount();
        let top = this.index.getTop().height;
        this.app.debug("info", "orwell", "found ", cnt, " in blockpool, top in index: ", top, (cnt > top + 1 || top == undefined) ? "reindex need" : "continue");
        return cnt > top + 1 || top == undefined;
    }
    clearIndexes() {
        //remove old utxo, indexes, orphanpool, sidepool
        return Promise.resolve()
            .then(() => {
                this.app.debug("info", "index", "clear old indexes");
                //remove utxo indexes
                let pr = this.utxo.clear();
                //remove indexes
                pr = pr.then(() => {
                    return this.index.clear();
                });
                //clear orphan pool
                pr = pr.then(() => {
                    return this.orphanpool.clear();
                });
                //side
                pr = pr.then(() => {
                    return this.sidepool.clear();
                });
                //mempool
                pr = pr.then(() => {
                    return this.mempool.clear();
                });

                return pr;
            });
    }
    reindexLocal() {

        let promise = this.clearIndexes();
        promise = promise.then(() => { return this.checkGenesis(); });

        let cnt = this.blockpool.blockCount();
        let i = 0;
        let height = this.index.getTop().height || 0;
        let hash = this.index.getTop().id || this.app.cnf('genesis').hash;
        let finded = false;
        while (i < cnt) {
            let list = this.blockpool.loadBlocks(1000, i) || []
            for (let k in list) {

                if (list[k].hash != hash && !finded)
                    continue;

                if (list[k].hash == hash && !finded) {
                    finded = 1;
                    continue;
                }

                promise = promise.then((res) => {
                    this.app.debug("debug", 'reindexer', 'load ', list[k].hash, height + 1)

                    finded = 1;
                    height++;
                    return this.indexBlockFromLocalStorage(this.BLOCK.fromJSON(list[k]), height)
                });
            }

            i += 1000;
        }


        return promise.then(() => {
            this.app.debug('info', 'orwell', 'block are reindexed ', this.index.getTop());
            return Promise.resolve();
        })
    }

    indexBlockFromLocalStorage(data, height) {
        if (height)
            data.height = height;

        let d = this.index.get("block/" + data.getId());

        if (!d || !d.prev) {

            try {//if have in blockpool - just update index
                this.getBlock(data.getId())
                console.log("block ", data.getId(), " found in block pool");
            } catch (e) {//else - add to blockpool and etc..
                return this.addBlockFromNetwork(null, data, '');
            }

            return this.consensus.dataManager.indexData(data, {
                chain: 'main',
                height: height,
            })
                .then((block) => {
                    return this.updateLatestBlock(block);
                })
        }

        return Promise.resolve(data);
    }

    addBlockFromNetwork(peer, data, from, cb) {
        let b;
        let res = this.consensus.getConsensus().applyData(peer, data);
        return res.promise
            .then((block) => {
                b = block;
                if (res.chain == 'main')
                    return this.updateLatestBlock(block);
                return Promise.resolve(block);
            })
            .then(() => {
                if (cb instanceof Function)
                    cb(b, res);
                return Promise.resolve(b);
            })
            .catch((e) => {
                console.log(e);
                if (cb instanceof Function)
                    cb(b, res);
                return Promise.resolve(b);
            })
    }

    updateLatestBlock(block) {
        return new Promise((resolve) => {
            if (block.getId() != this.app.cnf('genesis').hash) {
                let latest = this.blockpool.getLastBlock();
                let prev = null;
                let prevh = this.getTopInfo().height;
                try {
                    prev = this.getBlock(block.getPrevId());
                    prevh = this.getBlockHeight(prev.getId());
                } catch (e) {

                }

                //console.log('add block', block.getId(), 'prev', prev.getId(), "prevh", prevh, "h=", this.getTopInfo());

                if (prevh >= this.getTopInfo().height || (prev && prev.getId() == this.index.getTop().id) || block.getId() == this.app.cnf('genesis').hash) {
                    let b = {
                        id: block.getId(),
                        height: prevh + 1 || 0
                    }
                    this.index.updateTop(b)
                        .then(() => {
                            this.app.debug("info", "orwell", "new top", b);
                            this.app.emit("app.orwell.latest", b);
                            resolve();
                        })
                } else
                    resolve();
            } else {
                let b = {
                    id: block.getId(),
                    height: 0
                };

                this.index.updateTop(b)
                    .then(() => {
                        this.app.debug("info", "orwell", "new top", b);
                        this.app.emit("app.orwell.latest", b);
                        resolve();
                    })
            }
        });
    }

    sendBlock(data) {

    }

    getDiffForHeight(height) {
        return Math.ceil(this.consensus.getConsensus().next_network_target(height));
    }

    getTimeForHeight(height) {
        let avg = 1;
        let count = 12;

        if (height == -1)//genesis block
            return 0;

        let block = this.consensus.dataManager.getDataFromHeight(height);
        let list = [block];
        let i = 1;
        do {
            i++;
            block = this.getBlock(block.hashPrevBlock);
            list.push(block);
        } while (i < count && block.hashPrevBlock && i > 0);

        let times = [];
        for (let i in list) {
            avg += list[i].time;
            times.push(list[i].time);
        }

        return avg / count;
    }

    bits2target(bits) {
        let maxTarget = new BN(2).pow(new BN(250)).sub(new BN(1));
        if (bits < 1)
            bits = 1;
        let a = maxTarget.div(new BN(bits)).toBuffer('le');//get reverse buffer
        let paddSize = 32 - a.length;

        let padd = Buffer.allocUnsafe(paddSize).fill(0x0);
        let exp = Buffer.concat([a.slice(a.length - 4, a.length), padd]);

        let hash = Buffer.allocUnsafe(32).fill(0x0);
        this.app.tools.reverseBuffer(exp).copy(hash, 0, 0, exp.length);
        return hash.toString('hex');
    }

    target2bits(target) {
        let maxTarget = new BN(2).pow(new BN(250)).sub(new BN(1));
        let bits = maxTarget.div(new BN(target, 'hex'));
        return bits.toNumber();
    }

    checkHash(hash, target) {
        return this.consensus.getConsensus().checkHash(hash, target);
    }

    getDifficulty(bits) {
        if (!bits)
            bits = 1;
        let b = new BN(this.bits2target(this.app.cnf('consensus').maxtarget), 16);
        let m = new BN(this.bits2target(bits), 16);
        return (b.div(m).toString(10));
    }

    targetWeight(target) {
        let x = new BN(target, 'hex');
        let result = 0;

        if (!BN.isBN(x))
            return -1;

        while (x.toString(10) > 0) {
            x = x.shrn(1);
            result++;
        }

        return result;
    }

    getActualDiff() {
        return parseInt(this.consensus.getConsensus().next_network_target(this.getTopInfo().height));
    }

    getTopInfo() {
        if (this.app.cnf('genesisMode') == 1)
            return {
                id: '0000000000000000000000000000000000000000000000000000000000000000',
                height: -1

            };
        return this.consensus.dataManager.getTopInfo();
    }

    checkGenesis() {
        if (!this.index.get('index/0')) {
            this.app.debug("warn", "orwell", "Blockchain is empty: save genesis block");
            return this.saveGenesisBlock();
        }

        return Promise.resolve();
    }

    saveGenesisBlock() {
        return this.indexBlockFromLocalStorage(this.BLOCK.fromJSON(this.app.cnf('genesis')), 0);
    }

    addToMemPool(data, trigger, fromPeer) {
        return this.mempool.addTx(data, (tx, t, result) => {
            if (!result) {
                this.app.throwError("tx is invalid", tx.errors.join(","));
            }
        });
    }

    removeFromMemPool(hash) {
        return this.mempool.removeTx(hash);
    }

    getMemPool() {
        return this.mempool.getPriorityList();//order by fee
    }

    getKnownRange() {
        return this.consensus.getConsensus().getWindowRange();
    }

    sendTx(message) {
        return this.app.network.protocol.sendAll('mempool.tx', message);
    }


    getBlockList(last, first) {
        return this.consensus.dataManager.getDataSlice(last, first);
    }

    getHeaderList(last, first) {
        let arr = [];
        let list = this.consensus.dataManager.getDataSlice(last, first);
        for (let i in list) {
            arr.push(list[i].getHeaderHex());
        }
        return arr;
    }

    getBlockHeight(hash) {
        return this.consensus.dataManager.getDataHeight(hash);
    }

    getBlock(hash) {
        return this.consensus.dataManager.getData(hash);
    }

    getTx(hash) {
        return this.consensus.dataManager.getTx(hash);
    }
    getBlockValue(fee, height) {
        let emission_rules = this.app.cnf("consensus").emission;
        for (let i in emission_rules) {
            let from, to;
            let value = emission_rules[i];
            let a = i.split(",");
            let num = a[0], rule = a[1];
            let nums = num.split("-");
            if (nums.length > 1) {
                from = parseInt(nums[0]);
                to = parseInt(nums[1]);
            } else {
                from = to = parseInt(nums[0]);
            }

            if (from == to && height == from) {
                if (rule == 'height')
                    return new BN(value * height * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
                else
                    return new BN(value * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
            }

            if (from != to && height >= from && height <= to) {
                if (rule == 'height')
                    return new BN(value * height * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
                else
                    return new BN(value * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
            }
        }

        return fee;
    }
    getOut(hash, index) {
        return this.consensus.dataManager.getOut(hash, index);
    }

    getDatascriptList(dbname, raw, byDataset) {

        if (!raw && byDataset)
            return this.dsIndex.getDataSets(dbname);

        let addrind = this.index.get("ds/address/" + dbname);
        if (!addrind)
            addrind = [];

        let dscript = require('orwelldb').datascript;
        let dslist = [];

        for (let i in addrind) {
            let tx = null;
            try {
                tx = this.consensus.dataManager.getTx(addrind[i]).toJSON();
            } catch (e) {

            }

            if (!tx)
                continue;//its fiasco

            if (!tx.datascript)
                continue;//how,why?

            if (tx.coinbase)
                continue;//can not be coinbase

            let h = this.SCRIPT.sigToArray(tx.in[0].sig);
            let publicKey = h.publicKey;

            if (!byDataset && !raw) {
                let list = tx.datascript;
                for (let k in list) {
                    let data = new dscript(list[k]).toJSON();
                    data.writer = publicKey;
                    dslist.push(data);
                }
            }

            if (raw)
                dslist.push({ ds: tx.datascript, writer: publicKey })

        }

        return dslist;
    }
    getDatascriptSlice(dbname, dataset, limit, offset) {
        let dslist = [], actual = {}, create = false;
        let data = this.dsIndex.getData(dbname, dataset);

        for (let i in data) {
            if (data[i].operator == 'create' && !create)
                create = data[i];

            if (data[i].operator == 'create' || data[i].operator == 'settings')
                actual = data[i];

            dslist.push(data[i]);
        }

        if (actual.content && create.content)
            if (!actual.content.owner_key)
                actual.content.owner_key = create.content.owner_key;

        let items = dslist.slice(offset, offset + limit);
        return {
            actualSettings: actual,
            limit: limit,
            offset: offset,
            count: dslist.length,
            items: items.length,
            list: items
        }
    }
    getDataSets(dbname) {
        return this.dsIndex.getDataSetsCreation(dbname);
    }
    getDatabases(limit, offset) {
        let arr = this.index.getAllDSAddresses();
        if (!arr || !(arr instanceof Array))
            arr = []

        let items = arr.slice(offset, offset + limit);
        return {
            limit: limit,
            offset: offset,
            count: arr.length,
            items: items.length,
            list: items
        }
    }
    getDataSetInfo(dbname, dataset, limit, offset) {
        let list = this.dsIndex.getRecords(dbname, dataset);
        let settings = this.dsIndex.getDataSetsSettingsLast(dbname, dataset);
        let create = this.dsIndex.getDataSetCreationRecord(dbname, dataset);

        if (settings.content && create.content)
            if (!settings.content.owner_key)
                settings.content.owner_key = create.content.owner_key;

        let items = list.slice(offset, offset + limit);
        return {
            actualSettings: settings,
            creation: create,
            limit: limit,
            offset: offset,
            count: list.length,
            items: items.length,
            list: items
        }
    }
    resolveAddress(str) {
        let val = false;

        //todo dns db
        if (str == 'system')
            return this.app.cnf("orwelldb").systemAddress;


        try {
            val = this.app.orwell.ADDRESS.isValidAddress(str)
            if (!val)
                throw new Error('invalid address');
        } catch (e) {//not valid base58 is catched
            try {
                if (str.length == 40) {//hash of pubkey
                    str = this.app.orwell.ADDRESS.generateAddressFromAddrHash(str)
                    val = true;
                } else {
                    str = this.app.orwell.ADDRESS.generateAddressFromPublicKey(str);//its hash
                    val = true;
                }
            } catch (e) {
            }
        }

        return str;
    }
    resolveWalletAccount(str) {
        let acc = false;
        try {
            let addr = this.resolveAddress(str);
            acc = this.app.wallet.findAccountByAddr(addr);
            if (acc && acc.address && addr) {
                acc = this.app.wallet.findAccountByAddr(addr);
            } else
                acc = this.app.wallet.getAccount(str);
        } catch (e) {
            return false;
        }

        return acc;
    }
    createDb(accFrom, addressto, dataset, privileges, writeScript) {
        return new Promise((resolve, reject) => {
            if (!privileges)
                privileges = [];

            let e = new dscript({//create message must be unencrypted
                content: { owner_key: accFrom.publicKey, privileges: privileges, writeScript: writeScript ? '5560' : '' },
                dataset: dataset,
                operation: 'create',
            });

            let hex = e.toHEX();
            hex = dscript.writeArray([hex]);

            let result = app.wallet.sendFromAddress(accFrom.address, addressto, 0, hex);
            if (result.status) {
                resolve(result.hash, null);
            } else {
                resolve(null, { code: -1, message: result });
            }
        });
    }
    writeDb(accFrom, addressTo, dataset, content) {
        let dbname = app.orwell.ADDRESS.getPublicKeyHashByAddress(accFrom.address).toString('hex');
        return new Promise((resolve, reject) => {

            app.orwell.OVM.export(dbname, accFrom.publicKey, (db) => {
                let arr = [];
                try {
                    for (let i in content) {
                        arr.push(db.write(dataset, content[i]))
                    }
                } catch (e) {
                    resolve(null, e);
                    return;
                }

                return Promise.all(arr)
                    .then((res) => {
                        return Promise.resolve(res);
                    })
            })
                .then((hex) => {
                    //todo: rollback changes in db on send-error

                    if (hex == 'ef00') {
                        resolve(null, {
                            error: 'ds is not valid',
                            code: app.rpc.INVALID_RESULT
                        }, null);
                        return;
                    }

                    let result = app.wallet.sendFromAddress(accFrom.address, addressTo, 0, hex);
                    if (result.status) {
                        resolve(result.hash);
                    } else
                        resolve(null, {
                            error: result,
                            code: app.rpc.INVALID_RESULT
                        });

                })
                .catch(function (e) {
                    resolve(null, e);
                })
        });
    }
    getSystemAddress() {
        return app.cnf('orwelldb').systemAddress;
    }
    getSystemDb() {
        return app.orwell.ADDRESS.getPublicKeyHashByAddress(this.getSystemAddress()).toString('hex');
    }
    getDomainAddress(address) {
        if (address == this.app.cnf("orwelldb").systemAddress)
            return 'system'

        return false;
    }
    resolveDomain(address) {
        if (address == this.app.cnf("orwelldb").systemAddress)
            return 'system';

        //find domain by address
    }
    getTokenList(){
        //todo
    }
    getTokenAmount(dbname, publicKey) {
        //todo index token and domain into dsIndex
        let addr = this.ADDRESS.generateAddressFromPublicKey(publicKey);
        let ticker = this.dsIndex.get("token/address/" + dbname);
        return this.dsIndex.get(addr + "/token/" + ticker);
    }
    getTokenAddressAmount(dbname, address) {
        let ticker = this.dsIndex.get("token/address/" + dbname);
        return this.dsIndex.get(address + "/token/" + ticker);
    }

}

module.exports = orwell;