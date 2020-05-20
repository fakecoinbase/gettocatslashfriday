const consensus = require('consensusjs');

module.exports = (app, orwell) => {

    let cns = new consensus({
        "orwdpos": app.cnf('consensus'),
        "genesis": app.cnf('genesis')
    });

    //event handlers:

    cns.on("debug", (data) => {
        app.emit("app.debug", data);
    });

    cns.on("app.consensus.init", (data) => {
        //data.id - hash of top block after init
        //data.height - height of storage
    });

    cns.on("app.data.seek", (dataId) => {
        //need to search dataId in network (local data dont have this info)
    });

    cns.on("app.data.new", (data) => {
        if (app.db.get("activesync"))
            return false;

        if (app.getSyncState() != 'active')
            return false;

        if (data.chain != 'main')
            return false;

    });

    //cns.on("app.data{someDataId}");//emit this event when dataId added in main chain
    //cns.on("app.data.tx{someTxId}");//emit this event when data with txId added in main chain 
    cns.defineDataClass(orwell.BLOCK);

    /*cns.defineValidatorClass(((app) => {
        class Validator extends app.VALIDATOR {
            constructor(data) {
                super(data)
            }
            updatePriority(priority) {
                this.data.priority = priority;
                //create tx
            }

            setPriorityConfirm(f) {
                this.synced = !!f;
                //create tx - synced = false
                //tx in blockchain - synced = true
            }

            isPriorityConfirmed() {
                return this.synced;
            }
        }

        return Validator;
    })(cns));*/

    cns.defineConsensusClass(((app) => {
        class PoSConsensus extends app.CONSENSUS.DynamicDelegateProofOfStakeConsensus {
            constructor() {
                super("Orwell proof of stake consensus", "orwdpos")
            }
            isDataMatch(data) {
                return data.isValid();
            }
            isPeerCanSendData(peer) {
                //peer can be just broadcaster, check key of block instead
                return true;
                /*(if (app.dataManager.getHeight() < 0 || !app.dataManager.getHeight())
                    return true;//genesis
                return this.isDelegateMode() ? this.getConfig('delegates').indexOf(peer.getId()) != -1 : app.roundManager.isActiveValidator(peer.getId());
                */
            }
        }

        return PoSConsensus;
    })(cns));

    cns.definePeerManagerClass(((app) => {

        class PeerManager extends app.PEERMANAGER {
            //methods:
            //getPeersList() - get all connected peer list
            //addPeer(peer) - add new peer to list
            //removePeerById(peerId) - remove  peer by id
            //removePeer(peer) remove peer
            getPeersList() {
                return app.network.nodes.getMemoryList();
            }
        }

        return PeerManager;
    })(cns));

    cns.defineDataManagerClass(((fapp) => {

        class DataManager extends fapp.DATAMANAGER {
            constructor() {
                super();
            }

            getDataList() {
                let commonCnt = orwell.blockpool.blockCount(), m = 0;

                app.debug("info", "orwell", "blockchain local sync: finded " + commonCnt + " records, reading:");
                let blocks = [];
                let arr = orwell.blockpool.loadBlocks(commonCnt);//asc//todo, fix limit,offset

                for (let i in arr) {
                    if (arr[i]) {
                        let b = orwell.BLOCK.fromJSON(arr[i]);
                        blocks.push(b);
                        m++;
                    }
                }
                return blocks;
            }

            getSideList() {
                let commonCnt = orwell.sidepool.blockCount(), m = 0;
                let blocks = [];
                let arr = orwell.sidepool.loadBlocks(commonCnt);//asc//todo, fix limit,offset

                for (let i in arr) {
                    if (arr[i]) {
                        let b = orwell.BLOCK.fromJSON(arr[i]);
                        blocks.push(b);
                        m++;
                    }
                }
                return blocks;
            }

            getOrphanList() {
                let commonCnt = orwell.orphanpool.blockCount(), m = 0;
                let blocks = [];
                let arr = orwell.orphanpool.loadBlocks(commonCnt);//asc//todo, fix limit,offset

                for (let i in arr) {
                    if (arr[i]) {
                        let b = orwell.BLOCK.fromJSON(arr[i]);
                        blocks.push(b);
                        m++;
                    }
                }
                return blocks;
            }


            getData(id) {
                let block = false;
                block = orwell.blockpool.getBlock(id)
                if (block.p) {
                    delete block.meta
                    delete block.$loki;
                    let h = block.height;
                    block = app.orwell.BLOCK.fromJSON(block);
                    block.confirmation = orwell.index.get('top').height - h + 1;
                    block.chain = 'main';
                } else if (id != '0000000000000000000000000000000000000000000000000000000000000000')
                    return false;    //throw new Error('Block not found ' + id);

                return block;
            }

            getSideData(id) {
                let block = false;
                try {
                    block = orwell.sidepool.getBlock(id)
                } catch (e) {

                }

                if (block.p) {
                    delete block.meta
                    delete block.$loki;
                    block = app.orwell.BLOCK.fromJSON(block);
                    block.chain = 'side';
                }

                return block;
            }

            getOrphanData(id) {
                let block = false;
                try {
                    block = orwell.orphanpool.getBlock(id)
                } catch (e) {

                }

                if (block.hash) {
                    delete block.meta
                    delete block.$loki;
                    block = app.orwell.BLOCK.fromJSON(block);
                    block.chain = 'orphan';
                }

                return block;
            }

            getDataFromHeight(h) {
                let blockHash = orwell.index.get('index/' + h);
                if (!blockHash)
                    throw new Error('block height ' + h + ' is not exist');
                return this.getData(blockHash);
            }

            getDataHeight(dataId) {
                if (app.cnf('consensus').genesisMode)
                    return 0;

                if (dataId == this.getGenesis().hash)
                    return 0;

                if (dataId == '0000000000000000000000000000000000000000000000000000000000000000')
                    return -1;

                let blockNumber = orwell.index.get('block/' + dataId).height;

                if (!blockNumber) {
                    throw new Error('invalid data height ', dataId);
                }

                return blockNumber;
            }

            getHeight() {
                if (app.cnf('consensus').genesisMode)
                    return -1;
                return orwell.index.get('top').height;
            }

            getTopInfo() {
                return orwell.index.get('top');
            }

            indexData(data, options) {

                return new Promise((resolve) => {

                    if (!options.chain)
                        options.chain = 'main';

                    let path = '';
                    if (options.chain != 'main')
                        path = options.chain + '/';

                    orwell.index.setContext(options.chain + "/" + options.height);

                    let b = data.toJSON('hash');

                    let txpromises = [];
                    let dspromise = Promise.resolve();

                    for (let i in b.tx) {
                        let tx = b.tx[i];

                        txpromises.push(orwell.index.set(path + "tx/" + tx.hash, { block: b.hash, index: i }));
                        if (tx.hash) {
                            orwell.utxo.addTx(tx, options);

                            if (i != 0 && tx.coinbase)
                                throw new Error('coinbase tx can not be not first in list of block tx');//resync or maybe something like this

                            if (i == 0 && tx.coinbase) {//so.. havent inputs
                                let out = tx.out[0];
                                this.addOutIndex({
                                    type: 'input',
                                    hash: tx.hash,
                                    address: out.address,
                                    amount: out.amount
                                }, options);
                            } else {
                                for (let o in tx.out) {
                                    let out = tx.out[o];
                                    this.addOutIndex({
                                        type: 'input',
                                        index: o,
                                        hash: tx.hash,
                                        address: out.address,
                                        amount: out.amount
                                    }, options);
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
                                            amount: prevout.amount
                                        }, options);
                                }

                                if (tx.ds && !tx.coinbase) {
                                    this.addDSIndex({ hash: tx.hash, out: tx.out[0] }, options);
                                    dspromise = dspromise.then(() => { return app.orwell.dsIndex.addDatascript(tx, options) });
                                }

                                txpromises.push(orwell.mempool.removeTx(tx.hash));
                            }


                        }
                    }

                    Promise.all(txpromises.concat([
                        dspromise,
                        orwell.index.set(path + "index/" + options.height, b.hash),
                        orwell.index.set(path + "prev/" + b.hash, b.p),
                        orwell.index.set(path + "time/" + b.hash, b.t),
                        orwell.index.set(path + "block/" + b.hash, {
                            prev: b.p,
                            height: options.height
                        })
                    ]))
                        .then(() => {
                            orwell.index.setContext(null);
                            resolve(data);
                        })
                });

            }
            deleteIndex(data, options) {
                if (!options)
                    options = {};

                if (!options.chain)
                    options.chain = 'main';

                let path = '';
                if (options.chain != 'main')
                    path = options.chain + '/';

                let txpromises = [];
                let dspromise = Promise.resolve();
                let b = data.toJSON('hash');

                for (let i in b.tx) {
                    let tx = b.tx[i];

                    txpromises.push(orwell.index.remove(path + "tx/" + tx.hash));
                    if (tx.hash) {
                        orwell.utxo.removeTx(tx, options);

                        if (i != 0 && tx.cb)
                            throw new Error('coinbase tx can not be not first in list of block tx');//resync or maybe something like this

                        if (i == 0 && tx.cb) {//so.. havent inputs
                            let out = tx.out[0];
                            this.removeIndex({
                                type: 'input',
                                hash: tx.hash,
                                address: out.address,
                                amount: out.amount
                            }, options);
                        } else {
                            for (let o in tx.out) {
                                let out = tx.out[o];
                                this.removeIndex({
                                    type: 'input',
                                    index: o,
                                    hash: tx.hash,
                                    address: out.address,
                                    amount: out.amount
                                }, options);
                            }

                            for (let inp in tx.in) {
                                let inpt = tx.in[inp];
                                let prevout = this.getOut(inpt.hash, inpt.index);
                                if (prevout !== false)
                                    this.removeIndex({
                                        type: 'output',
                                        hash: tx.hash,
                                        index: inp,
                                        address: prevout.address,
                                        amount: prevout.amount
                                    }, options);
                            }

                            if (tx.ds && !tx.coinbase) {
                                this.removeDSIndex({ hash: tx.hash, out: tx.out[0] }, options);
                                dspromise = dspromise.then(() => { return app.orwell.dsIndex.removeDataScript(tx, options) });
                            }
                        }


                    }
                }

                return Promise.all(txpromises.concat([
                    dspromise,
                    orwell.index.remove(path + "index/" + options.height, data.getId()),
                    orwell.index.remove(path + "prev/" + data.getId()),
                    orwell.index.remove(path + "time/" + data.getId()),
                    orwell.index.remove(path + "block/" + data.getId())
                ]))
            }

            getTx(hash) {
                let txk = orwell.index.get("tx/" + hash);
                if (txk) {
                    let b = this.getData(txk.block);
                    let tx = b.tx[txk.index];
                    tx.fromBlock = txk.block;
                    tx.fromIndex = this.getDataHeight(txk.block);
                    return tx;
                } else {
                    throw new Error('can not find tx ' + hash);
                    //do inv with this hash
                    //return null;
                }

            }

            getOut(hash, index_cnt) {
                if (hash == "0000000000000000000000000000000000000000000000000000000000000000" && index_cnt == -1)
                    return false;
                let tx = this.getTx(hash);
                return tx.getOutputs()[index_cnt];
            }

            addOutIndex(data, options) {
                if (!options.chain)
                    options.chain = 'main';

                let path = '';
                if (options.chain != 'main')
                    path = 'main/';

                app.debug("info", "index", "add index " + data.address, data.hash, data.amount)

                let addrind = orwell.index.get(path + "address/" + data.address);
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

                addrind.push({
                    type: data.type, //input||output
                    tx: data.hash,
                    amount: data.amount
                });

                if (data.events) {
                    obj.address = data.address;
                    app.emit("chain.event.address", obj)
                }

                orwell.index.set(path + "address/" + data.address, addrind)
                return addrind
            }

            removeIndex(data, options) {
                if (!options.chain)
                    options.chain = 'main';

                let path = '';
                if (options.chain != 'main')
                    path = 'main/';

                let addrind = orwell.index.get(path + "address/" + data.address);
                if (!addrind || !(addrind instanceof Array))
                    addrind = [];

                let finded = 0, index = -1;
                for (let i in addrind) {
                    let _inx = addrind[i];
                    if (_inx == data.hash && _inx.index == data.index) {
                        finded = 1;
                        index = i;
                        break;
                    }
                }

                if (!finded)
                    return;

                addrind.splice(index, 1);

                orwell.index.set(path + "address/" + data.address, addrind)
            }

            addDSIndex(context, options) {
                if (!options.chain)
                    options.chain = 'main';

                let path = '';
                if (options.chain != 'main')
                    path = options.chain + '/';

                context.out.addrHash = orwell.ADDRESS.getPublicKeyHashByAddress(context.out.address).toString('hex');

                app.debug("info", "index", "add ds index " + context.out.addrHash, context.hash);

                let addrind = orwell.index.get(path + "ds/address/" + context.out.addrHash);
                if (!addrind || !(addrind instanceof Array))
                    addrind = [];

                addrind.push(context.hash);

                if (context.events) {
                    app.emit("chain.event.ds", {
                        address: context.out.addrHash,
                        txid: context.hash
                    })
                }

                orwell.index.set(path + "ds/address/" + context.out.addrHash, addrind)
                return addrind
            }

            removeDSIndex(context, options) {
                if (!options.chain)
                    options.chain = 'main';

                let path = '';
                if (options.chain != 'main')
                    path = options.chain + '/';

                context.out.addrHash = orwell.ADDRESS.getPublicKeyHashByAddress(context.out.address).toString('hex');
                let addrind = orwell.index.get(path + "ds/address/" + context.out.addrHash);
                if (!addrind || !(addrind instanceof Array))
                    addrind = [];

                let index = addrind.indexOf(context.hash);
                if (index != -1) {
                    addrind.splice(index, 1)
                }

                orwell.index.set(path + "ds/address/" + context.out.addrHash, addrind)
            }

            __addToMain(data, blockchain_height) {
                let d = {};
                try {
                    d = orwell.blockpool.getBlock(data.getId());
                } catch (e) {

                }

                if (!d.hash) {
                    let d = data.toJSON('hash');
                    return orwell.blockpool.save(d)
                        .then(() => {
                            return this.indexData(data, {
                                chain: 'main',
                                height: blockchain_height,
                            })
                                .then((res) => {
                                    cns.emit("app.data.new", {
                                        chain: 'main',
                                        height: blockchain_height,
                                        dataId: data.getId(),
                                    });
                                    return Promise.resolve(res);
                                })
                        })
                }

                return Promise.resolve(data);
            }

            __addToSide(data) {
                let hash = orwell.index.get('side/block/' + data.getId()).hash;
                if (!hash && !orwell.index.get('block/' + data.getId()).hash) {
                    let d = data.toJSON('hash');

                    return orwell.sidepool.save(d)
                        .then(() => {
                            return this.indexData(data, {
                                chain: 'side',
                            })
                                .then((res) => {
                                    cns.emit("app.data.new", {
                                        chain: 'side',
                                        dataId: data.getId(),
                                    });
                                    return Promise.resolve(res);
                                })
                        })
                }

                return Promise.resolve(true);
            }

            __addToOrphan(data) {
                let hash = orwell.index.get('orphan/block/' + data.getId()).hash;
                if (!hash && !orwell.index.get('side/block/' + data.getId()).hash && !orwell.index.get('block/' + data.getId()).hash) {
                    let d = data.toJSON('hash');

                    return orwell.orphanpool.save(d)
                        .then(() => {
                            return this.indexData(data, {
                                chain: 'orphan',
                            })
                                .then((res) => {
                                    cns.emit("app.data.new", {
                                        chain: 'orphan',
                                        dataId: data.getId(),
                                    });
                                    return Promise.resolve(res);
                                })
                        });
                }

                return Promise.resolve(true);
            }

            __addToTop(data, blockchain_height) {
                orwell.index.updateTop({
                    hash: data.getId(),
                    height: blockchain_height
                });
            }

            removeData(data, height) {
                //remove indexes
                this.deleteIndex(data.getId(), { chain: 'main', height: height })
                    .then(() => {
                        orwell.blockpool.removeBlock(data.getId());
                    })
            }

            removeSideBlock(data) {
                //remove indexes
                this.deleteIndex(data.getId(), { chain: 'side', height: height })
                    .then(() => {
                        orwell.sidepool.removeBlock(data.getId());
                    });
            }

            removeOrphanBlock(data) {
                //remove indexes
                this.deleteIndex(data.getId(), { chain: 'orphan', height: height })
                    .then(() => {
                        orwell.orphanpool.removeBlock(data.getId());
                    })
            }

            getDataSlice(numberFrom, numberTo) {
                console.log('get data slice', numberFrom, numberTo)
                let hash = orwell.index.get('index/' + numberFrom);
                if (!hash) {
                    numberFrom -= 1;
                    hash = orwell.index.get('index/' + (numberFrom));
                }

                if (numberTo < 0)
                    numberTo = 0;
                let hashTo = orwell.index.get('index/' + numberTo);


                console.log('get data slice hashes', hash, hashTo)

                let block = this.getData(hash);
                let num = numberFrom;

                if (hash == hashTo)
                    return [block];

                let list = [block];
                do {
                    let a = orwell.index.get('block/' + hash);
                    hash = a.prev;
                    num = a.height;
                    block = this.getData(hash);

                    if (!block.getId) {
                        console.log('missing block ', hash);
                        block = this.getSideData(hash);//why?!
                        console.log('get from side', block);
                        console.log('hash=', hash, 'hashTo=', hashTo);
                    }

                    list.unshift(block);

                    if (hash == hashTo)
                        break;

                    if (numberTo > num)
                        break;

                } while (hash != hashTo && hash != this.getGenesis().hash);

                return list;
            }

            getGenesis() {
                return app.orwell.BLOCK.fromJSON(app.cnf('genesis'));
            }

            seekBlockNetwork(id) {
                app.emit("chain.block.seek", { hash: id });
            }

        }

        return DataManager;
    })(cns));

    cns.start('default');//use default app.CONSENSUS (redefined)

    return cns;
}