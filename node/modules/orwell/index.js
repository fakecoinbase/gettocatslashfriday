const crypto = require('crypto');

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

        this.prepare();

        if (this.app.cnf('debug').indexing)
            this.app.debug("info", "btcchain", "storage loaded, can load indexes")
        //this entity can be loaded after db initialization.
        let BLOCKPOOL = require('./primitives/blockpool')(app);
        let ORPHAN = require('./primitives/orphanpool')(app);
        let SIDE = require('./primitives/sidepool')(app);
        let index = require('./indexer')(app);
        let UTXO = require('./utxo')(app);
        let MiningWork = require('./work')(app);

        this.prepare();
        if (this.app.cnf('debug').indexing)
            this.app.debug("info", "orwell", "storage loaded, can load indexes");

        this.blockpool = new BLOCKPOOL();
        this.orphanpool = new ORPHAN();
        this.sidepool = new SIDE();
        this.index = new index();
        this.utxo = new UTXO();
        this.miningWork = new MiningWork();
        this.checkpoint = require("./checkpoints");
        this.consensus = require("./consensus")(app, this);

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

            this.checkGenesis();
            /*if (!this.loadBlocksFromFile()) {
                this.generateGenesisBlock();
            }*/
            //if not have in file - generate genesis
            //this need update from network

            //reindex blocks, save to storage
            this.app.setSyncState('readyToSync')
            res();

            require('./rpc.methods')(this.app);
            this.app.rpc.start();

        });
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
            if (this.blockpool.blockCount() > 0) {
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
            } else
                resolve();
        });
    }

    sendBlock(data) {

    }

    getDiffForHeight(height) {
        return this.consensus.getConsensus().next_network_target(height);
    }

    getActualDiff() {
        return this.consensus.getConsensus().next_network_target(this.getTopInfo().height);
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
            this.saveGenesisBlock();
        }
    }

    saveGenesisBlock() {
        this.addBlockFromNetwork(null, this.BLOCK.fromJSON(this.app.cnf('genesis')));
    }

    addToMemPool(data, trigger) {

    }

    removeFromMemPool(hash) {

    }

    getMemPool() {
        return [];
    }

    getKnownRange() {
        return this.consensus.getConsensus().getWindowRange();
    }

    sendTx (message){

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

    getDatascriptList(dbname, raw, byDataset) {

        let addrind = this.index.get("ds/address/" + dbname);
        if (!addrind)
            addrind = [];

        /*if (raw) {
            var uncomfaddrind = txindexes.get("ds/address/" + dbname);
            if (!uncomfaddrind)
                uncomfaddrind = [];

            for (var i in uncomfaddrind) {//add to end of confirmed ds index - uncpmfirmed operations.
                addrind.push(uncomfaddrind[i]);
            }
        }*/

        let dscript = require('orwelldb').datascript;
        let dslist;
        if (byDataset)
            dslist = {};
        else
            dslist = [];

        for (let i in addrind) {
            let tx = null;
            try {
                tx = this.consensus.dataManager.getTx(addrind[i]);
            } catch (e) {
                //this tx from mempool 
                //if (raw)
                //    tx = txindexes.get(addrind[i]);
            }

            if (!tx)
                continue;//its fiasco

            if (!tx.datascript)
                continue;//how,why?

            if (tx.coinbase)
                continue;//can not be coinbase

            let h = this.SCRIPT.sigToArray(tx.in[0].scriptSig);
            let publicKey = h.publicKey;

            if (byDataset && !raw) {
                let list = dscript.readArray(tx.datascript);
                for (let k in list) {
                    let data = new dscript(list[k]).toJSON();
                    data.writer = publicKey;
                    if (!dslist[data.dataset])
                        dslist[data.dataset] = [];
                    dslist[data.dataset].push(data);
                }

            } else if (!byDataset && !raw) {
                let list = dscript.readArray(tx.datascript);
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
        let addrind = this.index.get("ds/address/" + dbname);
        if (!addrind)
            addrind = [];

        let dscript = require('orwelldb').datascript;
        let dslist = [], actual = {}, create = {};

        for (let i in addrind) {

            let tx = this.consensus.dataManager.getTx(addrind[i]);
            if (!tx.datascript)
                continue;//how,why?

            if (tx.coinbase)
                continue;//can not be coinbase

            let h = this.SCRIPT.sigToArray(tx.in[0].scriptSig);
            let publicKey = h.publicKey;

            let list = dscript.readArray(tx.datascript);
            for (let k in list) {
                let data = new dscript(list[k]).toJSON();

                if (data.dataset != dataset)
                    continue;

                if (data.operator == 'create')
                    create = data;

                if (data.operator == 'create' || data.operator == 'settings')
                    actual = data;

                data.writer = publicKey;
                dslist.push(data);
            }
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
        let addrind = this.index.get("ds/address/" + dbname);
        if (!addrind)
            addrind = [];

        let dscript = require('orwelldb').datascript;
        let dslist = [];

        for (let i in addrind) {

            let tx = this.consensus.dataManager.getTx(addrind[i]);
            if (!tx.datascript)
                continue;//how,why?

            if (tx.coinbase)
                continue;//can not be coinbase

            let h = this.SCRIPT.sigToArray(tx.in[0].scriptSig);
            let publicKey = h.publicKey;

            let list = dscript.readArray(tx.datascript);
            for (let k in list) {
                let data = new dscript(list[k]).toJSON();

                if (data.operator != 'create')
                    continue;

                data.writer = publicKey;
                dslist.push(data);
            }


        }

        return dslist;
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

}

module.exports = orwell;