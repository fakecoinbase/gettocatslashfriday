module.exports = function (app) {

    app.rpc.addMethod('ping', () => {
        return app.rpc.success({ pong: 1 })
    });

    app.rpc.addMethod("getblocktemplate", function (params) {
        let top = {}, bits = 0;
        if (app.cnf('consensus').genesisMode) {
            top = { height: -1, hash: '0000000000000000000000000000000000000000000000000000000000000000' };
            bits = parseInt(app.cnf('btcpow').maxtarget, 16);
        } else {
            top = app.btcchain.index.get('top');
            bits = app.btcchain.getActualDiff();
        }

        let txs = [];//txindexes.getOrderedList();
        let workid = app.btcchain.miningWork.createWorkId(top.hash, top.height, bits, txs.length);
        let work_ = app.btcchain.miningWork.get(workid);
        app.debug("info", "rpc", workid + ": " + (work_.workid ? 'hit' : 'miss'))
        if (work_.workid)
            return app.rpc.success(work_);

        let list = [], fee = 0, txlist = [];
        for (let i in txs) {
            let tr = new app.btcchain.TX.fromJSON(app, txs[i]);
            txlist.push(tr);
            let data = tr.toHex(), hash = tr.getHash(), f = tr.getFee();
            list.push({
                data: data,
                txid: hash,
                hash: hash,
                depends: [],
                fee: f,
                sigops: 0,
                weight: 0
            });

            fee += f;

        }

        let amount = app.pow.getBlockValue(fee, top.height + 1);
        let work = {
            capabilities: [],
            version: app.cnf("consensus").version,
            rules: [],
            previousblockhash: top.hash,
            coinbaseaux: { flags: "" },
            coinbasevalue: amount,
            target: app.pow.bits2target(bits).toString('hex'),
            mintime: parseInt(new Date().getTime() / 1000 - 3600),
            noncerange: "00000000ffffffff",
            sigoplimit: 1e7 / 50,
            sizelimit: app.cnf("consensus").blockSize,
            weightlimit: 4000000,
            curtime: parseInt(new Date().getTime() / 1000),
            bits: typeof bits != 'string' ? parseInt(bits).toString(16) : bits,
            mutable: [
                "time",
                "transactions",
                "prevblock"
            ],
            height: top.height + 1,
            transactions: list,
            workid: workid
        };

        app.debug("info", "rpc", work)
        app.btcchain.miningWork.set(workid, work);
        return app.rpc.success(work);

    });

    app.rpc.addMethod("validateaddress", function (params, cb) {
        let address = params[0];
        let val = false

        try {
            val = app.btcchain.ADDRESS.isValidAddress(address)
        } catch (e) {//not valid base58 is catched
            try {
                if (address.length == 40) {//hash of pubkey
                    addr = app.btcchain.ADDRESS.generateAddressFromAddrHash(addr)
                    val = true;
                } else {
                    addr = hash.generateAddressFromPublicKey(address);//its hash
                    val = true;
                }
            } catch (e) {

            }
        }

        return app.rpc.success({ isvalid: val, address: address });
    });

    app.rpc.addMethod("submitblock", function (params, cb) {
        let id = null;
        let b = null;

        let blockhex = params[0], workid = params[1];
        if (blockhex) {

            //console.log(blockhex);
            //if block vaild and work id exist - remove block id
            b = app.btcchain.BLOCK.fromHEX(app, blockhex);

            try {
                //TODO: check app state before

                if (app.cnf("consensus").genesisMode)
                    b.height = 0;
                else
                    b.height = app.btcchain.index.get('top').height + 1;
                app.btcchain.addBlock(b, 'rpc', { workid: workid }, function (block, _, inMainNet) {
                    //send to all
                    app.debug("info", "btcchain", "added new block by rpc ", block.hash, block.validation_errors.length, block.validation_errors);
                    if (workid)
                        app.btcchain.miningWork.remove(workid);

                    if (block.validation_errors.length == 0) {

                        if (app.cnf("consensus").genesisMode) {
                            console.log('completed, put next lines into config of your network:\n');
                            console.log('### NEW GENESIS ###\n');
                            let b = block.toJSON();
                            console.log(JSON.stringify({
                                header: {
                                    hash: b.hash,
                                    version: b.version,
                                    bits: b.bits,
                                    nonce: b.nonce,
                                    time: b.time,
                                    hashPrevBlock: b.hashPrevBlock,
                                    hashMerkleRoot: b.hashMerkleRoot,
                                },
                                txlist: [block.vtx[0].toHex()]
                            }));
                            console.log("### NEW GENESIS ###");
                            process.exit(0);//can not work non-stop in genesis mode
                        } else {
                            block.send();
                            cb(null, []);
                        }
                    } else {
                        cb(null, block.validation_erros[0]);
                    }
                });
            } catch (e) {
                //already have this tx or not valid data
                app.debug("info", "btcchain", 'block already exist', e)
                return app.rpc.error(-1, 'block already exist')
            }

            return -1;
        } else {
            return app.rpc.error(-1, 'invalid block hex');
        }
    });


    app.rpc.addMethod("getdifficulty", function (params, cb) {
        return app.rpc.success(app.pow.difficulty(app.btcchain.getActualDiff()));
    });

    app.rpc.addMethod("parseblock", function (params, cb) {
        return app.rpc.success(app.btcchain.BLOCK.fromHEX(app, params[0]));
    });

    app.rpc.addMethod("getinfo", function (params, cb) {
        return app.rpc.success({
            "version": app.cnf("consensus").version,
            "protocolversion": app.cnf("consensus").version,
            "walletversion": app.cnf("agent").version,
            "balance": 0,//TODO: wallet.getBalance(0),
            "blocks": app.btcchain.getCount(),
            "timeoffset": 0,
            "connections": 0,//app.network.protocol.getNodeList().length,//nodes.get("connections").length,
            "proxy": "",
            "difficulty": app.pow.difficulty(app.btcchain.getActualDiff()),
            "testnet": app.cnf('network') == 'testnet',
            "keypoololdest": [],//txindexes.getOldest(),
            "keypoolsize": 0,//txindexes.getCount(),
            "paytxfee": 0,//wallet.fee,
            "datasetfee": 0
        }
        );
    });

    app.rpc.addMethod("getmininginfo", function (params, cb) {
        return app.rpc.success({
            "blocks": app.btcchain.getCount(),
            "currentblocksize": 0,//txindexes.getSize(),
            "currentblocktx": 0,//txindexes.getCount(),
            "difficulty": app.pow.difficulty(app.btcchain.getActualDiff()),
            "genproclimit": 1,
            "networkhashps": app.pow.currHashRate(),
            "pooledtx": 0, //txindexes.getCount(),
            "testnet": app.cnf('network') == 'testnet',
            "chain": "main",
            "generate": false
        });
    });

}