const bitPony = require('bitpony');
const dscript = require('orwelldb').datascript;
const orwelldb = require('orwelldb');


module.exports = function (app) {

    app.rpc.addMethod("help", function (params, cb) {

        let out = "";
        let cliname = 'orw';

        function nl() {
            return "\n";
        }

        out += nl() + (cliname + " client " + app.cnf('agent').name + " " + app.cnf('agent').version)
        out += nl()
        out += nl() + ("Usage:")
        out += nl() + (cliname + " [option] <command>\tsend command to " + cliname)
        out += nl() + (cliname + " <command> help\t help about command")
        out += nl() + (cliname + " help\t commands list")
        out += nl()
        out += nl() + ("Available Commands:")
        out += nl() + ("> addresses:")
        out += nl() + (cliname + " getaddressbalance <address>")
        out += nl() + (cliname + " getaddressmempool <address>")
        out += nl() + (cliname + " getaddresstxids <address>")
        out += nl()
        out += nl() + ("> blockchain:")
        out += nl() + (cliname + " getbestblockhash")
        out += nl() + (cliname + " getblock <hash1,...,hashN>")
        out += nl() + (cliname + " getblockcount")
        out += nl() + (cliname + " getblockhash <index>")
        out += nl() + (cliname + " getblockheader <hash1,...,hashN>")
        out += nl() + (cliname + " getdifficulty")
        out += nl() + (cliname + " getmempoolinfo")
        out += nl() + (cliname + " getrawmempool")
        out += nl() + (cliname + " gettxout <txid> <n>")
        out += nl() + (cliname + " consensus")
        out += nl() + (cliname + " gettx <hash>")
        out += nl() + (cliname + " printtx <hash>")

        out += nl() + (cliname + " getblockchaininfo")//
        out += nl() + (cliname + " getspentinfo")
        out += nl() + (cliname + " gettxoutproof [<txid>,...] ( blockhash )")//
        out += nl() + (cliname + " verifychain [checklevel] [numblocks]")//
        out += nl() + (cliname + " getblockhashes <timestamp>")//?
        out += nl()
        out += nl() + ("> control:")
        out += nl() + (cliname + " help");
        out += nl() + (cliname + " stop")
        out += nl()
        out += nl() + ("> democracy:")
        out += nl() + (cliname + " democracy.create <type> [paramsjsonarray]")//create question
        out += nl() + (cliname + " democracy.info <id>")//get info about question
        out += nl()
        out += nl() + ("> Mining:")
        out += nl() + (cliname + " getblocktemplate <jsonobj>")
        out += nl() + (cliname + " submitblock <json>")

        out += nl() + (cliname + " getmininginfo")//
        out += nl()
        out += nl() + ("> Network:")
        out += nl() + (cliname + " getconnectioncount")//
        out += nl() + (cliname + " getnetworkinfo")//
        out += nl() + (cliname + " getpeerinfo")
        out += nl() + (cliname + " ping")//
        out += nl() + (cliname + " addnode <host//port> ")
        out += nl() + (cliname + " addnode <host> [port]")
        out += nl()
        out += nl() + ("> Rawtransactions:")
        out += nl() + (cliname + " createrawtransaction [ [tx, indexoutinthistx, addrin] ] [ [amountinsatoshi, address] ] ( locktime )")
        out += nl() + (cliname + " createrawtransaction <hex> ( locktime )");
        out += nl() + (cliname + " sendrawtransaction [ [tx, indexoutinthistx, addrin] ] [ [amountinsatoshi, address] ] ( locktime )");
        out += nl() + (cliname + " sendrawtransaction <hex>");
        out += nl() + (cliname + " getrawtransaction <txid>");
        out += nl() + (cliname + " sendrawtransaction <hex>");

        out += nl() + (cliname + " decoderawtransaction <hex> ");
        out += nl() + (cliname + " decodescript <hex>");//

        out += nl()
        out += nl() + ("> Datascript:")
        out += nl() + (cliname + " decodedatascript <hex> [dbname]"); //dbname used only if need decrypt datascript with keystore
        out += nl() + (cliname + " encodedatascript <json_array_of_dscommand> [dbname]"); //dbname used for encryption. If dbname is not specified - dont use encryption
        //pack datascript with create command and send tx to network:
        out += nl() + (cliname + " senddatascript <fromaddress> <toaddress> <hex>");
        out += nl() + (cliname + " dbcreate <fromaddress> <toaddress> <dataset> <privileges> [is_private=false]"); //is_private - is writeScript. If true - use 0x55 0x60 (that mean check privileges table), else write for all
        out += nl() + (cliname + " dbsettings <fromaddress> <toaddress> <dataset> <settings_json>"); //can change only privileges and writeScript in this version.
        out += nl() + (cliname + " dbwrite <fromaddress> <toaddress> <dataset> <data_json_array>"); //data is array of json_content or json_content. 
        //dbgetsettings
        //address to dbname
        //dbname to address
        //work with localdb
        out += nl() + (cliname + " syncdb <dbname>")//sync db from blockchain to local database
        out += nl() + (cliname + " cleardb <dbname>")//clear local database


        out += nl()
        out += nl() + ("> Keystore:")
        out += nl() + (cliname + " addpem <path/to/file> <dbname> [datasetname]");
        out += nl() + (cliname + " rempem <dbname> [datasetname]");
        out += nl() + (cliname + " getpem <dbname> [datasetname]");
        //todo: import/export keystore

        out += nl()
        out += nl() + ("> Wallet:")
        out += nl() + (cliname + " backupwallet <path/to>")
        out += nl() + (cliname + " dumpprivkey <address>")
        out += nl() + (cliname + " dumpwallet <path/to>")
        out += nl() + (cliname + " importwallet <path/from>")
        out += nl() + (cliname + " importprivkey <key>")

        out += nl() + (cliname + " getaccount <address>")
        out += nl() + (cliname + " getaccountaddress <account_name>")
        out += nl() + (cliname + " getaddressesbyaccount <account_name>")
        out += nl() + (cliname + " getnewaddress <account_name>")
        out += nl() + (cliname + " getbalance <account_name>")
        out += nl() + (cliname + " getreceivedbyaccount <account_name> [confirmation=6]")
        out += nl() + (cliname + " getreceivedbyaddress <address> [confirmation=6]")
        out += nl() + (cliname + " printtx <txid>")
        out += nl() + (cliname + " getunconfirmedbalance ")
        out += nl() + (cliname + " getwalletinfo <account_name>")
        out += nl() + (cliname + " listaccounts [confirmation=6]")
        out += nl() + (cliname + " listaddressgroupings ")
        out += nl() + (cliname + " listlockunspent ")
        out += nl() + (cliname + " listreceivedbyaccount [minconf=6]")
        out += nl() + (cliname + " listreceivedbyaddress [minconf=6] ")
        out += nl() + (cliname + " listtransactions <account_name> [count=500] [fromhash]")
        out += nl() + (cliname + " move <fromaccount> <toaccount> amount")
        out += nl() + (cliname + " sendmany <fromaccount> {'address':amount,...}")
        out += nl() + (cliname + " sendfrom <fromaccount> <address> <amount> [datascript]")
        out += nl() + (cliname + " sendtoaddress <address> <amount> [datascript]")
        out += nl() + (cliname + " setaccount <address> <account>")
        out += nl() + (cliname + " settxfee <amount>")
        out += nl() + (cliname + " signmessage <address> <message>")


        out += nl()
        out += nl() + ("> Util:")
        out += nl() + (cliname + " validateaddress <address>");
        out += nl() + (cliname + " verifymessage <address> <signature> <message>");

        return cb.apply(this, app.rpc.success(out));
    });


    app.rpc.addMethod('ping', () => {
        return app.rpc.success({ pong: 1 })
    });

    app.rpc.addMethod("getblocktemplate", function (params) {
        //params0 - account name for reward.
        let top = {}, bits = 0;
        if (app.cnf('consensus').genesisMode) {
            top = { height: -1, id: '0000000000000000000000000000000000000000000000000000000000000000' };
            bits = parseInt(app.cnf('btcpow').maxtarget, 16);
        } else {
            top = app.orwell.index.getTop();
            bits = app.orwell.getActualDiff();
        }

        let txs = app.orwell.mempool.getPriorityList();
        let workid = app.orwell.miningWork.createWorkId(top.id, top.height, bits, txs.length);
        let work_ = app.orwell.miningWork.get(workid);
        app.debug("info", "rpc", workid + ": " + (work_.workid ? 'hit' : 'miss'))
        if (work_.workid)
            return app.rpc.success(work_);

        let list = [], fee = 0, txlist = [];
        for (let i in txs) {
            let tr = new app.orwell.TX.fromJSON(txs[i]);
            txlist.push(tr);
            let data = tr.toHex(), hash = tr.getHash(), f = tr.getFee();
            list.push({
                data: data,
                txid: hash,
                hash: hash,
                fee: f,
            });

            fee += f;
        }

        let keys = app.wallet.getAccount(params[1] ? params[1] : 'miner')
        let coinbase = app.orwell.TX.createCoinbase([keys.privateKey], top.height, fee);
        let coinbaseTx = {
            data: coinbase.toHex(),
            txid: coinbase.getHash(),
            hash: coinbase.getHash(),
            fee: coinbase.getFee(),
        }

        //TODO: 10% of reward go to block author in "submitblock" method
        //TODO: masternodes fee
        let amount = app.pow.getBlockValue(fee, top.height + 1);

        let work = {
            capabilities: [],
            version: app.cnf("consensus").version,
            rules: [],
            previousblockhash: top.id,
            coinbaseaux: { flags: "" },
            coinbasevalue: amount,
            coinbaseTX: coinbaseTx,
            target: app.orwell.bits2target(bits),
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
        app.orwell.miningWork.set(workid, work);
        return app.rpc.success(work);

    });

    app.rpc.addMethod("validateaddress", function (params, cb) {
        let address = params[0];
        let val = false

        try {
            val = app.orwell.ADDRESS.isValidAddress(address)
        } catch (e) {//not valid base58 is catched
            try {
                if (address.length == 40) {//hash of pubkey
                    addr = app.orwell.ADDRESS.generateAddressFromAddrHash(addr)
                    val = true;
                } else {
                    addr = app.orwell.ADDRESS.generateAddressFromPublicKey(address);//its hash
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


            let h = app.orwell.index.get('top').height + 1;
            b = app.orwell.BLOCK.fromHEX(blockhex);

            try {
                if (app.cnf("consensus").genesisMode)
                    b.height = 0;
                else
                    b.height = h;
                app.orwell.addBlock(b, 'rpc', { workid: workid }, function (block, _, inMainNet) {
                    //send to all
                    app.debug("info", "orwell", "added new block by rpc ", block.hash, block.validation_errors.length, block.validation_errors);
                    if (workid)
                        app.orwell.miningWork.remove(workid);

                    if (block.validation_errors.length == 0) {

                        if (app.cnf("consensus").genesisMode) {
                            out += nl() + ('completed, put next lines into config of your network:\n');
                            out += nl() + ('### NEW GENESIS ###\n');
                            let b = block.toJSON();
                            out += nl() + (JSON.stringify({
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
                            out += nl() + ("### NEW GENESIS ###");
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
                app.debug("info", "orwell", 'block already exist', e)
                return app.rpc.error(-1, 'block already exist')
            }

            return -1;
        } else {
            return app.rpc.error(-1, 'invalid block hex');
        }
    });


    app.rpc.addMethod("getdifficulty", function (params, cb) {
        return app.rpc.success(app.pow.difficulty(app.orwell.getActualDiff()));
    });

    app.rpc.addMethod("parseblock", function (params, cb) {
        return app.rpc.success(app.orwell.BLOCK.fromHEX(params[0]));
    });

    app.rpc.addMethod("getinfo", function (params, cb) {
        return app.rpc.success({
            "version": app.cnf("consensus").version,
            "protocolversion": app.cnf("consensus").version,
            "walletversion": app.cnf("agent").version,
            "balance": 0,//TODO: wallet.getBalance(0),
            "blocks": app.orwell.blockpool.blockCount(),
            "timeoffset": 0,
            "connections": app.network.protocol.getNodeList().length,
            "proxy": "",
            "difficulty": app.pow.difficulty(app.orwell.getActualDiff()),
            "testnet": app.cnf('network') == 'testnet',
            "keypoololdest": app.orwell.mempool.getOldest(),
            "keypoolsize": app.orwell.mempool.getCount(),
            "paytxfee": 0,//wallet.fee,
            "datasetfee": 0
        }
        );
    });

    app.rpc.addMethod("getmininginfo", function (params, cb) {
        return app.rpc.success({
            "blocks": app.orwell.blockpool.blockCount(),
            "currentblocksize": app.orwell.mempool.getSize(),
            "currentblockfee": app.orwell.mempool.getFee(),
            "currentblocktx": app.orwell.mempool.getCount(),
            "difficulty": app.pow.difficulty(app.orwell.getActualDiff()),
            "genproclimit": 1,
            "networkhashps": app.pow.currHashRate(),
            "testnet": app.cnf('network') == 'testnet',
            "chain": app.cnf('network'),
            "generate": false
        });
    });

    app.rpc.addMethod("sendtoaddress", function (params, cb) {
        let address = params[0];
        let amount = params[1];
        let dsHEX = params[2] ? params[2] : '';
        let result = app.wallet.send(0, address, amount * app.cnf('consensus').satoshi, dsHEX);

        if (result.status) {
            return app.rpc.success(result.hash);
        } else
            return app.rpc.error(app.rpc.INVALID_RESULT, result.error);
    });

    app.rpc.addMethod("sendfrom", function (params, cb) {
        let account_id = params[0], address = params[1], amount = params[2], datascriptHEX = params[3];
        let acc = app.orwell.resolveWalletAccount(account_id);
        let to = app.orwell.resolveAddress(address);


        if (!acc || !acc.address)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'account not exist');

        if (!app.orwell.ADDRESS.isValidAddress(to))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address is not valid ' + to);

        if (amount <= 0)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'amount is not valid');

        let result = app.wallet.sendFromAddress(acc.address, to, amount * app.cnf('consensus').satoshi, datascriptHEX);

        if (result.status) {
            return app.rpc.success(result.hash);
        } else
            return app.rpc.error(app.rpc.INVALID_RESULT, result);
    });

    app.rpc.addMethod("listaccounts", function (params, cb) {

        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        return app.rpc.success(list);
    });

    app.rpc.addMethod("accountaddress", function (params, cb) {
        let id = params[0];

        if (!id)
            id = 0;

        let obj = app.wallet.getAccount(id);
        return app.rpc.success(obj.address);
    });

    app.rpc.addMethod("dumpprivkey", function (params, cb) {
        let addr = params[0];

        if (!addr || !app.orwell.ADDRESS.isValidAddress(addr))
            return app.rpc.error(app.rpc.INVALID_PARAMS, "need valid address to dump private key");

        let obj = app.wallet.findAccountByAddr(addr);

        if (!obj || !obj.privateKey)
            return app.rpc.error(app.rpc.INVALID_PARAMS, "need valid and exist address to dump private key");

        let key = obj.privateKey;
        let pub = obj.publicKey;

        return app.rpc.success({ address: addr, publicKey: pub, privateKey: key });
    });

    app.rpc.addMethod("balance", function (params, cb) {
        let id = params[0];
        let balance = app.wallet.getBalance(id);
        return app.rpc.success({ balance: balance / app.cnf('consensus').satoshi + 0 });
    });

    app.rpc.addMethod("chain", function (params, cb) {

        let limit = params[0] || 30, offset = params[1] || 0, list = [];
        let arr = app.orwell.blockpool.getLastBlocks(limit, offset);

        for (let i in arr) {
            let block = arr[i];
            block.output = 0;
            block.size = 0;
            block.fee = 0;

            block.diff = app.orwell.getDifficulty(block.bits);
            for (let i in block.tx) {
                block.size += block.tx[i].size;
                block.fee += block.tx[i].fee / app.cnf('consensus').satoshi;
                for (let k in block.tx[i].out) {
                    block.output += block.tx[i].out[k].amount / app.cnf('consensus').satoshi;
                }
            }

            delete block.$loki;
            delete block.meta;
            delete block.tx//too many bytes
            list.push(block);
        }

        let count = app.orwell.blockpool.blockCount();
        return app.rpc.success({ list: list, offset: offset, limit: limit, items: list.length, count: count });
    });

    app.rpc.addMethod("bestblockhash", function (params, cb) {
        let info = app.orwell.index.getTop();

        if (!info.id)
            info = { hash: app.orwell.GENESIS.hash, height: 0 };
        else
            info.hash = info.id;

        return app.rpc.success(info);
    });

    let block_fnc = function (method, params, cb) {

        let hashes = [];
        if (method == 'height') {

            let numbers = params;
            for (let k in numbers) {
                let hash = app.orwell.index.get("index/" + numbers[k]);
                if (hash)
                    hashes.push(hash);
            }

        } else {
            hashes = params;
        }

        if (!hashes.length)
            return app.rpc.error(app.rpc.INVALID_PARAMS, "need one or more hashes")

        let list = [];
        for (let i in hashes) {

            let block;
            try {
                block = app.orwell.getBlock(hashes[i]);
            } catch (e) {
                //your face, when you can not find block in blockchain _/(o_0)-/
                continue;
            }

            block = block.toJSON();

            block.diff = block.bits;
            block.reward = app.orwell.getBlockValue(block.fee, block.height) / app.cnf('consensus').satoshi;
            block.next_block = app.orwell.index.get("index/" + (block.height + 1));
            for (let k in block.tx) {
                block.tx[k].block = block.hash;

                let tx_in = 0;
                for (let m in block.tx[k].in) {
                    let a = app.orwell.SCRIPT.sigToArray(block.tx[k].in[m].sig);
                    block.tx[k].in[m].writer = a.publicKey;
                    block.tx[k].in[m].writerAddress = app.orwell.ADDRESS.generateAddressFromPublicKey(a.publicKey);
                    block.tx[k].in[m].sign = a.der;

                    let prevout = app.orwell.consensus.dataManager.getOut(block.tx[k].in[m].hash, block.tx[k].in[m].index);
                    if (prevout && prevout.amount)
                        tx_in += prevout.amount;

                }

                let tx_out = 0;
                for (let m in block.tx[k].out) {
                    tx_out += block.tx[k].out[m].amount;
                }

                block.tx[k].in_amount = tx_in / app.cnf('consensus').satoshi;
                block.tx[k].out_amount = tx_out / app.cnf('consensus').satoshi;

                if (block.tx[k].coinbaseBytes) {
                    let cbData = {};
                    let reader = new bitPony.reader(new Buffer(block.tx[k].coinbaseBytes, 'hex'));
                    let res = reader.string(0);
                    cbData['authorName'] = res.result.toString();
                    res = reader.string(res.offset);
                    cbData['hardwareName'] = res.result.toString();
                    res = reader.uint32(res.offset);
                    cbData['time'] = res.result;
                    res = reader.var_int(res.offset);
                    cbData['bytes_length'] = res.result;
                    cbData['bytes'] = [];
                    let offset = res.offset;

                    for (let m = 0; m < cbData['bytes_length']; m++) {
                        res = reader.uint8(offset);
                        cbData['bytes'].push(parseInt(res.result).toString(16));
                        offset = res.offset;
                    }

                    block.tx[k].coinbaseData = cbData;
                }

            }

            if (block)
                list.push(block);

        }
        return app.rpc.success(list);
    }

    app.rpc.addMethod("height", (params, cb) => {
        return block_fnc('height', params, cb);
    });

    app.rpc.addMethod("block", function (params, cb) {
        return block_fnc('block', params, cb);
    });


    app.rpc.addMethod("tx", function (params, cb) {
        let hash = params[0];
        let returnRawData = params[1];

        if (!hash) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, "need one or more hashes")
        } else {

            let tx;
            try {
                tx = app.orwell.consensus.dataManager.getTx(hash);
                if (tx)
                    tx = tx.toJSON();
            } catch (e) {

            }

            if (!tx) {//search in mempool

                tx = app.orwell.mempool.get(hash);
                if (tx)
                    tx.fromMemoryPool = true;
            } else {

                let txk = app.orwell.index.get("tx/" + tx.hash);
                let b = app.orwell.consensus.dataManager.getData(txk.block);
                tx.confirmation = app.orwell.index.get('top').height - b.height + 1;
                tx.fromBlock = b.hash;
                tx.fromIndex = txk.index;
                tx.time = b.time;
            }

            if (!tx)
                return app.rpc.error(app.rpc.INVALID_RESULT, 'havent tx with this hash');

            let tx_in = 0;
            for (let m in tx.in) {
                let a = app.orwell.SCRIPT.sigToArray(tx.in[m].sig);
                tx.in[m].writer = a.publicKey;
                tx.in[m].writerAddress = app.orwell.ADDRESS.generateAddressFromPublicKey(a.publicKey);
                tx.in[m].sign = a.der;

                let prevout = app.orwell.consensus.dataManager.getOut(tx.in[m].hash, tx.in[m].index);
                if (prevout && prevout.amount)
                    tx_in += prevout.amount;

            }

            let tx_out = 0;
            for (let m in tx.out) {
                tx_out += tx.out[m].amount;
            }

            if (tx.coinbaseBytes) {
                let cbData = {};
                let reader = new bitPony.reader(new Buffer(tx.coinbaseBytes, 'hex'));
                let res = reader.string(0);
                cbData['authorName'] = res.result.toString();
                res = reader.string(res.offset);
                cbData['hardwareName'] = res.result.toString();
                res = reader.uint32(res.offset);
                cbData['time'] = res.result;
                res = reader.var_int(res.offset);
                cbData['bytes_length'] = res.result;
                cbData['bytes'] = [];
                let offset = res.offset;

                for (let m = 0; m < cbData['bytes_length']; m++) {
                    res = reader.uint8(offset);
                    cbData['bytes'].push(parseInt(res.result).toString(16));
                    offset = res.offset;
                }

                tx.coinbaseData = cbData;
            } else if (tx.datascript) {
                let list = [];
                let a = [];

                if (returnRawData)
                    tx.dslist = [];

                if (tx.coinbase)
                    tx.commonInput = tx.commonOut;

                tx.dataScriptContent = [];
                tx.dataScriptDomain = app.orwell.getDomainAddress(tx.out[0].address);

                if (tx.datascript instanceof Array)
                    a = tx.datascript;
                else
                    a = dscript.readArray(tx.datascript);

                for (let i in a) {
                    if (returnRawData)
                        tx.dslist.push(a[0])
                    let d = new dscript(a[i]);
                    list.push(d.toJSON())
                }

                tx.dataScriptContent = list;
            }



            tx.in_amount = tx_in / app.cnf('consensus').satoshi;
            tx.out_amount = tx_out / app.cnf('consensus').satoshi;
            tx.hex = app.orwell.TX.fromJSON(tx).toHex().toString('hex');

            return app.rpc.success(tx);
        }
    });

    app.rpc.addMethod("address", function (params, cb) {

        let addr;
        let address = params[0], limit = parseInt(params[1]), offset = parseInt(params[2]);
        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        if (!address)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'need address');

        try {
            app.orwell.ADDRESS.isValidAddress(address).toString('hex');
            addr = address
        } catch (e) {//not valid base58 is catched
            try {
                if (address.length == 40) {//hash of pubkey
                    addr = app.orwell.ADDRESS.generateAddressFromAddrHash(address)
                } else
                    addr = app.orwell.ADDRESS.generateAddressFromPublicKey(address);//its hash
            } catch (e) {
                return app.rpc.error(app.rpc.INVALID_PARAMS, 'not valid address' + address);
            }
        }

        if (!app.orwell.ADDRESS.isValidAddress(addr))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'not valid address' + addr);

        return app.rpc.success({
            address: addr,
            hash160: app.orwell.ADDRESS.getPublicKeyHashByAddress(addr).toString('hex'),
            unspent: app.orwell.utxo.getUTXOList(addr, limit, offset)
        });

    });

    app.rpc.addMethod("dbinfo", function (params, cb) {
        let db = params[0], dataset = params[1], limit = parseInt(params[2]), offset = parseInt(params[3]);
        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        if (!db)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'dbname is required');

        let address = app.orwell.resolveAddress(db);
        let dbname = app.orwell.ADDRESS.getPublicKeyHashByAddress(address).toString('hex');

        if (!dataset) {
            let arr = app.orwell.getDataSets(dbname);
            let addressDomain = app.orwell.resolveDomain(address);
            cb.apply(null, app.rpc.success({
                address: address,
                hash160: dbname,
                addressDomain: addressDomain,
                list: arr
            }));
            return -1;
        } else {
            let records = app.orwell.getDatascriptSlice(dbname, dataset, limit, offset);
            records.address = address;
            records.hash160 = dbname;
            records.dataset = dataset;
            records.addressDomain = app.orwell.resolveDomain(address);
            cb.apply(null, app.rpc.success(records));
            return -1;
        }
    });

    app.rpc.addMethod("dblist", function (params, cb) {
        let limit = parseInt(params[0]), offset = parseInt(params[1]);
        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        let arr = app.orwell.getDatabases(limit, offset);
        return app.rpc.success(arr);
    });

    app.rpc.addMethod("dbrecords", function (params, cb) {
        let db = params[0], dataset = params[1], limit = parseInt(params[2]), offset = parseInt(params[3]);

        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        return app.rpc.success(app.orwell.getDataSetInfo(db, dataset, limit, offset));
    });

    app.rpc.addMethod("peerinfo", function (params, cb) {
        let peers = app.network.protocol.getNodeList(), peerinfo = {};
        for (let i in peers) {
            let d = app.network.nodes.get("data/" + peers[i]);
            let rinfo = app.network.protocol.getUniqAddress(peers[i]);
            if (rinfo.remoteAddress == '127.0.0.1')
                continue;

            d.lastMsg = new Date().getTime() / 1000 - d.lastRecv;
            peerinfo[rinfo.remoteAddress + "//" + rinfo.port] = d;
        }

        return app.rpc.success(peerinfo);
    });

    app.rpc.addMethod("mempoolinfo", function (params, cb) {
        let list = app.orwell.mempool.getList(), arr = [];
        for (let i in list) {
            let time = app.orwell.mempool.get("time/" + list[i]);
            arr.push({ time: time, hash: list[i] });
        }

        return app.rpc.success(arr);
    });

    //datascript
    app.rpc.addMethod("dbcreate", (params, cb) => {
        let addressfrom = params[0],
            addressto = params[1],
            datasetname = params[2],
            priv = params[3] || "[]",
            privateWriting = params[4];

        let acc = app.orwell.resolveWalletAccount(addressfrom);
        addressto = app.orwell.resolveAddress(addressto);

        if (!acc.address)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressto is not valid');

        if (!datasetname)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'datasetname is not exist');

        let privileges = [];
        try {
            privileges = JSON.parse(priv);
        } catch (e) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'privileges is not valid json array');
        }

        if (!privileges instanceof Array)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'privileges can be only array');

        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressfrom is not exist in yout wallet');

        app.orwell.createDb(acc, addressto, datasetname, privileges, privateWriting)
            .then((result, error) => {
                if (result) {
                    return app.rpc.success(result);
                } else {
                    return app.rpc.error(error.code, error.message);
                }
            })

        return -1;
    });

    app.rpc.addMethod("dbsettings", function (params, cb) {

        let addressfrom = params[0], addressto = params[1], datasetname = params[2], priv = params[3] || "[]", privateWriting = params[4];

        let acc = app.orwell.resolveWalletAccount(addressfrom);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressfrom account is not found (is not exist in yout wallet)');

        let addressTo = app.orwell.resolveAddress(addressto);
        if (!app.orwell.ADDRESS.isValidAddress(addressTo))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressto is not valid');

        if (!datasetname)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'datasetname is not exist');

        let privileges = [];
        try {
            privileges = JSON.parse(priv);
        } catch (e) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'privileges is not valid json array');
        }

        if (!privileges instanceof Array)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'privileges can be only array');

        let e = new dscript({//settings message must be unencrypted
            content: { privileges: privileges, writeScript: privateWriting ? '5560' : '' },
            dataset: datasetname,
            operation: 'settings',
        });

        let hex = e.toHEX();
        hex = dscript.writeArray([hex]);

        let result = app.wallet.sendFromAddress(acc.address, addressTo, 0, hex);

        if (result.status) {
            return app.rpc.success(result.hash);
        } else
            return app.rpc.error(app.rpc.INVALID_RESULT, result);

    });

    app.rpc.addMethod("dbwrite", (params, cb) => {

        let addressfrom = params[0], addressto = params[1], dataset = params[2], json = params[3];

        if (!dataset)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'dataset is required');

        let acc = app.orwell.resolveWalletAccount(addressfrom);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressfrom is not valid account or address');

        let addrto = app.orwell.resolveAddress(addressto);
        if (!app.orwell.ADDRESS.isValidAddress(addrto))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressto is not valid');

        addressto = addrto;

        if (!json)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'data_json_array is required');

        try {
            content = JSON.parse(json);
        } catch (e) {
            try {
                let base64 = new Buffer(json, 'base64').toString('utf8');
                content = JSON.parse(base64)
            } catch (e) {
                return app.rpc.error(app.rpc.INVALID_PARAMS, 'data_json_array is not valid json array')
            }
        }

        if (!acc)
            return cb({ error: 'addressfrom is not exist in yout wallet', code: app.rpc.INVALID_PARAMS }, null);

        if (!(content instanceof Array))
            content = [content];

        app.orwell.writeDb(acc, addressto, dataset, content)
            .then((result, error) => {
                cb(result, error);
            })
        return -1;

    });

    app.rpc.addMethod("createtoken", (params, cb) => {

        let addressfrom = params[0], tokenaddress = params[1], tokenticker = params[2], opts = params[3];

        if (!tokenaddress)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'tokenaddress is required');

        if (!tokenticker)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'tokenaddress is required');

        if (app.orwell.dsIndex.get("token/" + tokenticker)) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'this token ticker already exist');
        }

        if (app.orwell.dsIndex.get("token/address/" + tokenaddress)) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'token on this address already exist');
        }

        let acc = app.orwell.resolveWalletAccount(addressfrom);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address from is not valid account or address. Must exists in your wallet.');

        let addrto = app.orwell.resolveWalletAccount(tokenaddress);
        if (!app.orwell.ADDRESS.isValidAddress(addrto))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'Tokenaddress is not valid account or address. Must exists in your wallet.');
        tokenaddress = addrto;

        if (!opts)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'opts is required');

        try {
            content = JSON.parse(opts);
        } catch (e) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'opts is required');
        }

        if (!content.emission)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'emission option is required');

        app.orwell.OVM.syncdb(app.orwell.getSystemDb())
            .then(() => {
                return app.orwell.writeDb(acc, app.orwell.getSystemAddress(), 'tokens', {
                    ticker: tokenticker,
                    address: tokenaddress.address,
                    emission: opts.emission,
                    isStock: opts.isStock || false,
                    title: opts.title || tokenticker
                })

            })
            .then((result, error) => {
                if (!result) return app.rpc.error(app.rpc.INVALID_PARAMS, error.message);
                return app.orwell.createDb(acc, tokenaddress.address, 'token')
            })
            .then((result, error) => {
                if (!result) return app.rpc.error(app.rpc.INVALID_PARAMS, error.message);
                return app.orwell.writeDb(acc, tokenaddress.address, 'token', {//initial pay
                    from: tokenaddress.address,
                    to: tokenaddress.address,
                    amount: opts.emission
                })

            })

        return -1;

    });

    app.rpc.addMethod("initblockchain", (params, cb) => {
        //create system db domains 
        //create system db tokens
        //create system db masternodes

    });

}