const crypto = require('crypto');
const dscript = require('orwelldb').datascript;
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

        let primitives = require('./primitives/index')(app);

        this.TX = primitives.Transaction;
        this.BLOCK = primitives.Block;

        //this entity can be loaded after db initialization.
        let BLOCKPOOL = require('./primitives/blockpool')(app);
        let MEMPOOL = require('./mempool')(app);
        let ORPHAN = require('./primitives/orphanpool')(app);
        let SIDE = require('./primitives/sidepool')(app);
        let index = require('./indexer')(app);
        let UTXO = require('./utxo')(app);
        let UTXH = require('./utxh')(app);
        let DSINDEX = require('./dsindex')(app);

        require('./validations')(this.app, this);
        this.app.debug("info", "index", "storage loaded, can load indexes");

        this.blockpool = new BLOCKPOOL();
        this.mempool = new MEMPOOL();
        this.orphanpool = new ORPHAN();
        this.sidepool = new SIDE();
        this.index = new index();
        this.utxo = new UTXO();
        this.utxh = new UTXH();
        this.dsIndex = new DSINDEX();
        //this.miningWork = new MiningWork();
        this.checkpoint = require("./checkpoints");
        this.consensus = require("./consensus")(app, this);
        this.OVM = require("./orwellvm")(app);
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
        })
            .then(() => {

                if (!this.app.cnf('consensus').genesisMode && Number.isFinite(this.app.orwell.index.get('top').height)) {
                    this.app.debug("info", "validatormanager", "start timer");
                    this.restartTimer()
                }

                return Promise.resolve();
            })
    }

    restartTimer() {
        setTimeout(() => {
            this.app.debug("info", "validatormanager/timer", "check current validator");
            this.app.validatormanager.checkActiveValidator();
            this.restartTimer();
        }, 10000)
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

        let k = Math.ceil(cnt / 1000) + 1;
        for (let i = 0; (i / 1000) + 1 <= k; i += 1000) {
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

        }


        return promise.then(() => {
            this.app.debug('info', 'orwell', 'block are reindexed ', this.index.getTop());
            return Promise.resolve();
        })
    }
    indexBlock(hashes) {
        let promise = Promise.resolve();
        for (let i in hashes) {
            let block = this.getBlock(hashes[i]);
            let h = this.index.get('block/' + block.getPrevId()).height;
            if (h && h > 0) {
                promise = promise.then(() => {
                    return this.consensus.dataManager.indexData(block, {
                        chain: 'main',
                        height: h + 1,
                    })
                        .then((b) => {
                            return this.updateLatestBlock(b);
                        })
                })
            }
        }

        return promise;
    }
    indexBlockFromLocalStorage(data, h) {
        if (h != undefined)
            data.height = h;

        let d = this.index.get("block/" + data.getId());

        if (!d || !d.getPrevId()) {

            try {//if have in blockpool - just update index
                this.getBlock(data.getId())
            } catch (e) {//else - add to blockpool and etc..
                return this.addBlockFromNetwork(null, data, {
                    chain: 'main',
                    height: h,
                });
            }

            return this.consensus.dataManager.indexData(data, {
                chain: 'main',
                height: h,
            })
                .then((block) => {
                    return this.updateLatestBlock(block);
                })
        }

        return Promise.resolve(data);
    }

    addBlockFromNetwork(peer, data, context, cb) {
        let b;

        if (this.index.get("block/" + data.getId()).height) {
            cb(data, { 'chain': 'main_dup' });
            return Promise.resolve(data);
        }

        if (context && isFinite(context.height))
            data.height = context.height;
        else if (!data.height) {
            let previd = data.getPrevId();
            let h = this.index.get("block/" + previd);
            if (h)
                data.height = h.height + 1;
            else if (previd == '0000000000000000000000000000000000000000000000000000000000000000')
                data.height = 0;
        }

        let res = this.consensus.getConsensus().applyData(peer, data);
        return res.promise
            .then((block) => {
                block.chain = res.chain;
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
        if (height == -1 || height == 0)//genesis block
            return 0;

        let block = this.consensus.dataManager.getDataFromHeight(height);
        let list = [block];
        let i = 1;
        do {
            if (block.getPrevId() == this.app.cnf('genesis').hash)
                break;

            i++;
            block = this.getBlock(block.getPrevId());
            list.push(block);
        } while (i < count && block && i > 0);

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
        return new Promise((resolve, reject) => {
            this.mempool.addTx(data, (tx, t, result) => {
                if (!result) {
                    reject(["tx is invalid: ", tx.errors.join(",")]);
                    return;
                }

                resolve(tx);
            });
        })
    }

    removeFromMemPool(hash) {
        return this.mempool.removeTx(hash);
    }

    getMemPool() {
        return this.mempool.getPriorityList();//order by fee
    }

    getKnownRange() {
        return [0, this.index.getTop().height];
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
        let mainblock = this.consensus.dataManager.getData(hash);
        let sideblock = this.consensus.dataManager.getSideData(hash);
        let orphanblock = this.consensus.dataManager.getOrphanData(hash);

        if (mainblock)
            return mainblock;
        if (sideblock)
            return sideblock;
        if (orphanblock)
            return orphanblock;

        throw new Error('block ' + hash + " not exist in any pool");
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
    getAddressBalance(address) {
        this.utxo.checkAndUnlock(address);
        let arr = this.utxo.get("address/" + address);

        if (!arr) {
            arr = [];
        }

        let a = 0;
        for (let i in arr) {

            if (!arr[i].spent && !arr[i].spentHash && !arr[i].locked)
                a += arr[i].amount;
        }

        return a;
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
                tx = this.consensus.dataManager.getTx(addrind[i]).toJSON('hash');
            } catch (e) {

            }

            if (!tx)
                continue;//its fiasco

            if (!tx.ds)
                continue;//how,why?

            if (tx.coinbase)
                continue;//can not be coinbase

            let publicKey = tx.s[0][1];

            if (!byDataset && !raw) {
                let list = tx.ds instanceof Array ? tx.ds : dscript.readArray(tx.ds);
                for (let k in list) {
                    let data = new dscript(list[k]).toJSON();
                    data.writer = publicKey;
                    dslist.push(data);
                }
            }

            if (raw)
                dslist.push({ ds: tx.ds, writer: publicKey })

        }

        return dslist;
    }
    getDatascriptMempoolList(dbname, raw, byDataset) {
        let addrind = this.mempool.get("ds/address/" + dbname);
        if (!addrind)
            addrind = [];

        let dscript = require('orwelldb').datascript;
        let dslist = [];
        if (byDataset)
            dslist = {};

        for (let i in addrind) {
            let tx = null;
            try {
                tx = this.mempool.getTx(addrind[i]);
            } catch (e) {

            }

            if (!tx)
                continue;//its fiasco

            if (!tx.ds)
                continue;//how,why?

            if (tx.coinbase)
                continue;//can not be coinbase

            let publicKey = tx.s[0][1];

            if (!byDataset && !raw) {
                let list = tx.ds instanceof Array ? tx.ds : dscript.readArray(tx.ds);
                for (let k in list) {
                    let data = new dscript(list[k]).toJSON();
                    data.writer = publicKey;
                    dslist.push(data);
                }
            } else if (!raw && byDataset) {
                let list = tx.ds instanceof Array ? tx.ds : dscript.readArray(tx.ds);
                for (let k in list) {
                    let data = new dscript(list[k]).toJSON();
                    data.writer = publicKey;
                    if (!dslist[data.dataset])
                        dslist[data.dataset] = [];
                    dslist[data.dataset].push(data);
                }
            }

            if (raw)
                dslist.push({ ds: tx.ds, writer: publicKey })
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
    getTokenHistory(ticker, limit, offset) {
        let arr = this.dsIndex.getTokenHistoryAll(ticker);
        if (!arr || !(arr instanceof Array))
            arr = []

        let items = arr.reverse().slice(offset, offset + limit);
        return {
            limit: limit,
            offset: offset,
            count: arr.length,
            items: items.length,
            list: items
        }
    }
    getAddressTokenHistory(address, limit, offset) {
        let arr = this.dsIndex.getAddressHistoryAll(address);
        if (!arr || !(arr instanceof Array))
            arr = []

        let items = arr.reverse().slice(offset, offset + limit);
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
    getDomainInfo(name) {
        if (name == 'system')
            return this.app.cnf('orwelldb').systemKey;

        let key = this.dsIndex.get("domain/" + name);
        return key || false;
    }
    getKeyDomain(key) {
        if (this.app.cnf('orwelldb').systemKey == key)
            return 'system';

        let domain = this.dsIndex.get("domain/key/" + key);
        return domain || false;
    }
    getAddressDomain(address) {
        if (this.app.cnf('orwelldb').systemAddress == address)
            return 'system';

        let domain = this.dsIndex.get("domain/address/" + address);
        return address || false;
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
    deploySystemDb(account) {
        return new Promise((resolve, reject) => {

            let e1 = new dscript({
                content: { owner_key: account.publicKey, privileges: "", writeScript: '' },
                dataset: 'masternodes',
                operation: 'create',
            });

            let e2 = new dscript({
                content: { owner_key: account.publicKey, privileges: "", writeScript: '' },
                dataset: 'domains',
                operation: 'create',
            });

            let e3 = new dscript({
                content: { owner_key: account.publicKey, privileges: "", writeScript: '' },
                dataset: 'tokens',
                operation: 'create',
            });

            let hex = dscript.writeArray([e1.toHEX(), e2.toHEX(), e3.toHEX()]);
            this.app.wallet.sendFromAddress(account.address, this.app.cnf('orwelldb').systemAddress, 0, hex)
                .then((result) => {
                    resolve(result.hash);
                })
                .catch((e) => {
                    reject({
                        error: e,
                        code: this.app.rpc.INVALID_RESULT
                    });
                })

        });

        //masternodes content: {key: 'pubkey', priority: 0}
        //domains content: {domain:'domain-name', key: 'pubkey'}
        //tokens content: {ticker: 'name', address: 'addr', emission: '', isStock: true/false, title: ''}

        /*return new Promise((resolve, reject) => {


            this.createDb(account, this.app.cnf('orwelldb').systemAddress, 'masternodes')
                .then((hash) => {
                    hashes.push(hash);
                    return this.createDb(account, this.app.cnf('orwelldb').systemAddress, 'domains')
                })
                .then((hash) => {
                    hashes.push(hash);
                    return this.createDb(account, this.app.cnf('orwelldb').systemAddress, 'tokens')
                }).then((hash) => {
                    hashes.push(hash);
                    resolve(hashes);
                })
            //write first datas after

        });*/


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

            this.app.wallet.sendFromAddress(accFrom.address, addressto, 0, hex)
                .then((result) => {
                    resolve(result.hash);
                })
                .catch((e) => {
                    if (typeof e == 'string')
                        resolve(e);
                    else
                        reject({
                            error: e,
                            code: this.app.rpc.INVALID_RESULT
                        });
                })

        });
    }
    writeMultiDb(accFrom, addrAmountObj, dbAddress, dataset, contentArr) {
        return this.writeDb(accFrom, addrAmountObj, dataset, contentArr, dbAddress)
    }
    writeDb(accFrom, addressTo, dataset, content, dbAddress) {//addressTo can be object addr=>amount, in this case we use dbAddress
        let dbname = null;
        if (typeof addressTo == 'object' && content instanceof Array && content.length) { //multi address addr=>amount
            let ad = dbAddress;
            dbname = this.ADDRESS.getPublicKeyHashByAddress(ad).toString('hex');
        } else
            dbname = this.ADDRESS.getPublicKeyHashByAddress(addressTo).toString('hex');
        return new Promise((resolve, reject) => {
            this.OVM.syncdb(dbname)
                .then(() => {

                    this.OVM.export(dbname, accFrom.publicKey, (db) => {
                        let arr = [];
                        try {
                            for (let i in content) {
                                arr.push(db.write(dataset, content[i]))
                            }
                        } catch (e) {
                            reject(e);
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
                                reject({
                                    error: 'ds is not valid',
                                    code: this.app.rpc.INVALID_RESULT
                                }, null);
                                return;
                            }

                            if (typeof addressTo == 'object') {
                                this.app.wallet.sendMultiFromAddress(accFrom.address, addressTo, hex)
                                    .then((result) => {
                                        resolve(result.hash);
                                    })
                                    .catch((e) => {
                                        reject({
                                            error: e,
                                            code: this.app.rpc.INVALID_RESULT
                                        });
                                    })
                            } else
                                this.app.wallet.sendFromAddress(accFrom.address, addressTo, 0, hex)
                                    .then((result) => {
                                        resolve(result.hash);
                                    })
                                    .catch((e) => {
                                        reject(e);
                                    })

                        })
                        .catch(function (e) {
                            console.log(e);
                            reject("catched: " + e.message);
                        })
                })
        });
    }
    sendToken(ticker, accountFrom, addressTo, amount) {

        return new Promise((resolve, reject) => {

            let tokenaddress = this.dsIndex.get("token/" + ticker);

            if (!tokenaddress) {
                reject({
                    error: "Token " + ticker + "  is not found",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            let senderBalance = this.dsIndex.get(accountFrom.address + "/token/" + ticker);
            if (senderBalance < amount) {
                reject({
                    error: "Sender dont have " + ticker + " tokens",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            if (!this.ADDRESS.isValidAddress(addressTo)) {
                reject({
                    error: "Address to is not valid",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            let opts = this.dsIndex.get("token/data/" + ticker);
            if (amount <= 0 || amount > opts.emission) {
                reject({
                    error: "Amount is not valid",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            return this.writeDb(accountFrom, tokenaddress, 'token', [{
                from: accountFrom.address,
                to: addressTo,
                amount: amount
            }])
                .then((res) => {
                    resolve(res);
                })
                .catch((err) => {
                    reject(err);
                })

        });

    }
    createToken(acc, tokenAccount, ticker, content) {
        let hashes = [];

        return new Promise((resolve, reject) => {
            this.OVM.syncdb(this.getSystemDb())
                .then(() => {
                    let data = {
                        ticker: ticker,
                        address: tokenAccount.address,
                        emission: content.emission,
                        isStock: content.isStock || false,
                        title: content.title || ticker
                    };

                    if (content.isStock)
                        data.share = content.share || 0.3;

                    return this.writeDb(acc, this.getSystemAddress(), 'tokens', [data])
                })
                .then((result, error) => {
                    if (!result) return this.app.rpc.error(this.app.rpc.INVALID_PARAMS, error.message);
                    hashes.push(result);
                    return this.createDb(acc, tokenAccount.address, 'token')
                })
                .then((result, error) => {
                    if (!result && error) return this.app.rpc.error(this.app.rpc.INVALID_PARAMS, error.message);
                    if (result)
                        hashes.push(result);
                    return this.writeDb(acc, tokenAccount.address, 'token', [{//initial pay
                        from: tokenAccount.address,
                        to: tokenAccount.address,
                        amount: content.emission
                    }])

                })
                .then((result, error) => {
                    if (!result && error) return this.app.rpc.error(this.app.rpc.INVALID_PARAMS, error.message);
                    if (result)
                        hashes.push(result);
                    resolve(hashes)
                })
                .catch((err) => {
                    reject(err)
                })
        })
    }
    payStockHolders(ticker, acc, amount) {
        return new Promise((resolve, reject) => {

            let tokenaddress = this.dsIndex.get("token/" + ticker);
            let opts = this.dsIndex.get('token/data/' + ticker);

            if (!tokenaddress) {
                reject({
                    error: "Token " + ticker + "  is not found",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            let holders = this.dsIndex.getTokenHolders(ticker);
            let shareAmount = amount * (opts.share ? opts.share : 0.3);
            let profitAmount = amount - shareAmount;
            if (profitAmount < 0) {
                reject({
                    error: "Profit of stock address must be bigger or equal then 0",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            let shares = {};
            for (let k in holders) {
                let balanceToken = this.getTokenAddressAmount(ticker, holders[k]);
                shares[holders[k]] = (balanceToken / opts.emission) * shareAmount * this.app.cnf('consensus').satoshi;
            }

            //write to history pay dividends with to = 0.

            shares[tokenaddress] += profitAmount * this.app.cnf('consensus').satoshi;//tokenowner is tokenholdertoo + profit go to wallet
            return this.writeMultiDb(acc, shares, tokenaddress, 'token', [{
                from: acc.address,
                to: 0,
                amount: amount,
                share: shareAmount
            }])
                .then((res) => {
                    resolve(res);
                })
                .catch((err) => {
                    reject(err);
                })

        });
    }
    addMasternode(account) {
        return new Promise((resolve, reject) => {

            let mn = this.dsIndex.get("masternode/" + account.publicKey);
            if (mn) {
                reject({
                    error: "Masternode already exist",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            return this.writeDb(account, this.getSystemAddress(), 'masternode', [{
                key: account.publicKey,
                priority: 0
            }])
                .then((res) => {
                    resolve(res);
                })
                .catch((err) => {
                    reject(err);
                })

        });
    }
    updateMasternodes(account, masternodesvalues) {//only for active validator, else will return reject.
        return new Promise((resolve, reject) => {

            return this.writeDb(account, this.getSystemAddress(), 'masternode', masternodesvalues)
                .then((res) => {
                    resolve(res);
                })
                .catch((err) => {
                    reject(err);
                })

        });
    }
    createDomain(account, domain, pubkey) {
        return new Promise((resolve, reject) => {

            let mn = this.dsIndex.get("domain/" + domain);
            if (mn) {
                reject({
                    error: "Domain already exist",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            mn = this.dsIndex.get("domain/key/" + pubkey);
            if (mn) {
                reject({
                    error: "Address already have domain",
                    code: this.app.rpc.INVALID_RESULT
                });
                return;
            }

            return this.writeDb(account, this.getSystemAddress(), 'domains', [{
                domain: domain,
                key: pubkey
            }])
                .then((res) => {
                    resolve(res);
                })
                .catch((err) => {
                    reject(err);
                })

        });
    }
    getSystemAddress() {
        return this.app.cnf('orwelldb').systemAddress;
    }
    getSystemDb() {
        return this.ADDRESS.getPublicKeyHashByAddress(this.getSystemAddress()).toString('hex');
    }
    getDomainsList() {
        return this.dsIndex.getDomainsList();
    }
    getDomainAddress(addressOrPubKey) {
        if (addressOrPubKey == this.app.cnf("orwelldb").systemAddress)
            return 'system'

        let one = this.dsIndex.get("domain/key/" + addressOrPubKey);
        let two = this.dsIndex.get("domain/address/" + addressOrPubKey) || false;
        return one ? one : two;
    }
    resolveDomain(addressOrPubKey) {
        if (addressOrPubKey == this.app.cnf("orwelldb").systemAddress)
            return 'system';

        //find domain by address
        let one = this.dsIndex.get("domain/key/" + addressOrPubKey);
        let two = this.dsIndex.get("domain/address/" + addressOrPubKey) || false;
        return one ? one : two;
    }
    resolveDomainName(domain) {
        if (domain == 'system')
            return this.app.cnf("orwelldb").systemKey;

        return this.dsIndex.get("domain/" + domain);
    }
    getTokenList(limit, offset) {
        let list = this.dsIndex.getTokenList();
        let items = list.slice(offset, offset + limit);

        let obj = {};
        for (let i in list) {
            obj[list[i]] = this.dsIndex.get("token/data/" + list[i]);
            obj[list[i]].holders = this.dsIndex.get("token/holders/" + list[i]).length || 1;
        }

        return {
            limit: limit,
            offset: offset,
            count: Object.keys(list).length,
            items: items.length,
            list: obj
        }

    }
    getTokenTicker(address) {
        return this.dsIndex.getTokenTicker(address);
    }
    getTokenAddress(ticker) {
        return this.dsIndex.getTokenAddress(ticker);
    }
    getTokenAddressAmount(token, address) {
        return this.dsIndex.getTokenBalance(token, address);
    }
    getTokenAddressHistory(token, address) {
        return this.dsIndex.getTokenHistory(token, address);
    }
    getTokensAddressAmount(address) {
        return this.dsIndex.getTokensBalance(address);
    }
    getTokensAddressHistory(address) {
        return this.dsIndex.getTokensHistory(address);
    }
    getConsensus() {
        let lastRound = this.consensus.roundManager.getLastState();
        let nextRound = {
            validators: this.consensus.roundManager.getValidatorsList(),
            cursor: 0
        };

        return {
            last: lastRound,
            next: nextRound
        }
    }

}

module.exports = orwell;