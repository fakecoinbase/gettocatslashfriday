const consensus = require('consensusjs');

module.exports = (app, orwell) => {

    let cns = new consensus({
        "orwdpos": app.cnf('consensus'),
        "genesis": app.cnf('genesis')
    });

    //event handlers:

    cns.on("debug", (data) => {
        console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
    });

    cns.on("app.consensus.init", (data) => {
        //data.id - hash of top block after init
        //data.height - height of storage
    });

    cns.on("app.data.seek", (dataId) => {
        //need to search dataId in network (local data dont have this info)
    });

    //cns.on("app.data{someDataId}");//emit this event when dataId added in main chain
    //cns.on("app.data.tx{someTxId}");//emit this event when data with txId added in main chain 

    cns.defineDataClass(((app) => {

        class DATA extends app.DATA {
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

            getStakeValue(height) {
                //this method only for proof of stake consensus
                //public key = this.getKey();
                //get from blockchain outs for key 
                return 0;
            }
        }

        return DATA;
    })(cns));

    cns.defineConsensusClass(((app) => {
        class PoSConsensus extends app.CONSENSUS.ProofOfWorkConsensus {//app.CONSENSUS.ProofOfStakeConsensus
            constructor() {
                super("Orwell proof of stake consensus", "orwdpos")
            }
            isDataMatch() {
                return true;
            }
            getStakeToTargetTransform(publicKey, stake, target) {

                /*let share = stake / allcoins;//[0;1]
                let shareAll = 0.3 * share;//max share - 30%
                return target * (1 - shareAll);//min: 0.7 * target, max: 1 * target*/

                return target;

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

                if (app.cnf('debug').blockchain_sync)
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
                try {
                    block = orwell.blockpool.getBlock(id)
                } catch (e) {

                }

                if (block.hash) {
                    delete block.meta
                    delete block.$loki;
                    block.confirmation = orwell.index.get('top').height - block.height + 1;
                    block = app.orwell.BLOCK.fromJSON(block);
                } else if (id != '0000000000000000000000000000000000000000000000000000000000000000')
                    throw new Error('Block not found ' + id);

                return block;
            }

            getSideData(id) {
                let block = false;
                try {
                    block = orwell.sidepool.getBlock(id)
                } catch (e) {

                }

                if (block.hash) {
                    delete block.meta
                    delete block.$loki;
                    block = app.orwell.BLOCK.fromJSON(block);
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
                }

                return block;
            }

            getDataFromHeight(h) {
                let blockHash = orwell.index.get('index/' + h);
                if (!blockHash)
                    throw new Error('block ' + blockHash + ' is not exist');
                return this.getData(blockHash);
            }

            getDataHeight(dataId) {
                let blockNumber = orwell.index.get('block/' + dataId).height;
                if (!blockNumber && blockNumber != 0)
                    throw new Error('block ' + dataId + ' is not exist');
                return blockNumber;
            }

            getHeight() {
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
                        path = 'main/';

                    orwell.index.setContext(options.chain + "/" + options.height);

                    let b = data.toJSON();
                    for (let i in b.tx) {
                        let tx = b.tx[i];
                        orwell.index.set(path + "tx/" + tx.hash, { block: b.hash, index: i });
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

                                if (tx.datascript) {
                                    this.addDSIndex({ hash: tx.hash, out: tx.out[0] }, options)
                                }

                                //TODO: remove from mempool
                                //var mempool = require('../db/entity/tx/pool')
                                //mempool.removeTx(tx.hash)
                            }


                        }
                    }

                    orwell.index.set(path + "index/" + options.height, b.hash);
                    orwell.index.set(path + "prev/" + b.hash, b.prev);
                    orwell.index.set(path + "time/" + b.hash, b.time);
                    orwell.index.set(path + "block/" + b.hash, {
                        prev: b.prev,
                        height: options.height
                    });

                    orwell.index.setContext(null);
                    resolve(data);
                });

            }

            getTx(hash) {
                let txk = orwell.index.get("tx/" + hash);

                if (txk) {
                    let b = this.getData(txk.block);
                    let tx = b.tx[txk.index];
                    tx.confirmation = orwell.index.get('top').height - b.height + 1;
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

            addOutIndex(data, options) {
                if (!options.chain)
                    options.chain = 'main';

                let path = '';
                if (options.chain != 'main')
                    path = 'main/';

                if (app.cnf('debug').blockchain_sync)
                    app.debug("info", "orwell", "add index " + data.address, data.hash, data.amount)

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

            addDSIndex(context, options) {
                if (!options.chain)
                    options.chain = 'main';

                let path = '';
                if (options.chain != 'main')
                    path = 'main/';

                context.out.address = orwell.SCRIPT.scriptToAddr(context.out.scriptPubKey);
                context.out.addrHash = orwell.SCRIPT.scriptToAddrHash(context.out.scriptPubKey).toString('hex');

                if (app.cnf('debug').indexing)
                    app.debug("info", "orwell", "add ds index " + context.out.addrHash, context.hash);

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

            __addToMain(data, blockchain_height) {
                let hash = orwell.index.get('block/' + data.getId()).hash;
                if (!hash) {
                    return orwell.blockpool.save(data.toJSON())
                        .then(() => {
                            return this.indexData(data, {
                                chain: 'main',
                                height: blockchain_height,
                            });
                        })
                }

                return Promise.resolve(true);
            }

            __addToSide(data) {
                let hash = orwell.index.get('side/block/' + data.getId()).hash;
                if (!hash && !orwell.index.get('block/' + data.getId()).hash) {
                    return orwell.sidepool.save(data.toJSON())
                        .then(() => {
                            return this.indexData(data, {
                                chain: 'side',
                            })
                        })
                }

                return Promise.resolve(true);
            }

            __addToOrphan(data) {
                let hash = orwell.index.get('orphan/block/' + data.getId()).hash;
                if (!hash && !orwell.index.get('side/block/' + data.getId()).hash && !orwell.index.get('block/' + data.getId()).hash) {
                    return orwell.orphanpool.save(data.toJSON())
                        .then(() => {
                            return this.indexData(data, {
                                chain: 'orphan',
                            });
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
                orwell.blockpool.removeBlock(data.getId());
            }

            removeSideBlock(data) {
                //remove indexes
                orwell.sidepool.removeBlock(data.getId());
            }

            removeOrphanBlock(data) {
                //remove indexes
                orwell.orphanpool.removeBlock(data.getId());
            }

            getDataSlice(numberFrom, numberTo) {
                let hash = orwell.index.get('index/' + numberFrom);
                if (!hash) {
                    numberFrom -= 1;
                    hash = orwell.index.get('index/' + (numberFrom));
                }

                if (numberTo < 0)
                    numberTo = 0;
                let hashTo = orwell.index.get('index/' + numberTo);
                let block = this.getData(hash);
                if (hash == hashTo)
                    return [block];

                let list = [block];
                do {
                    hash = orwell.index.get('block/' + hash).prev;
                    block = this.getData(hash);
                    list.unshift(block);
                } while (hash != hashTo && hash != this.getGenesis().hash);

                return list;
            }

            getGenesis() {
                return app.orwell.BLOCK.fromJSON(app.cnf('genesis'));
            }

        }

        return DataManager;
    })(cns));

    cns.start('default');//use default app.CONSENSUS (redefined)

    return cns;
}