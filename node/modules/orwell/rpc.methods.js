const bitPony = require('bitpony');
const dscript = require('orwelldb').datascript;

module.exports = function (app) {

    app.rpc.handlers.chain = function (params, cb) {
        let limit = params[0] || 30, offset = params[1] || 0, list = [];
        let arr = app.orwell.blockpool.getLastBlocks(limit, offset);

        for (let i in arr) {
            let block = arr[i];
            let b = app.orwell.BLOCK.fromJSON(arr[i]);
            block = b.toJSON('hash,fee,size,height,confirmation,hrk');
            block.output = 0;
            block.size = 0;
            block.fee = 0;

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
    }

    app.rpc.handlers.block = function (method, params, cb) {

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

            block = block.toJSON('hash,fee,size,height,confirmation,fromBlock,hrk');

            block.reward = app.orwell.getBlockValue(block.fee, block.height) / app.cnf('consensus').satoshi;
            block.next_block = app.orwell.index.get("index/" + (block.height + 1));
            for (let k in block.tx) {
                block.tx[k].block = block.hash;

                let tx_in = 0;
                for (let m in block.tx[k].in) {
                    block.tx[k].in[m].writer = block.tx[k].s[m][1];
                    block.tx[k].in[m].writerAddress = app.orwell.ADDRESS.generateAddressFromPublicKey(block.tx[k].s[m][1]);
                    block.tx[k].in[m].sign = block.tx[k].s[m][0];

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

                if (block.tx[k].cb) {
                    let cbData = {};
                    try {
                        let reader = new bitPony.reader(new Buffer(block.tx[k].cb, 'hex'));
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
                    } catch (e) {
                        cbData['bytes'] = [];
                        let offset = 0;
                        let res = 0;
                        let buff = new Buffer(block.tx[k].cb, 'hex');
                        let reader = new bitPony.reader(buff);
                        for (let m = 0; m < buff.length; m++) {
                            res = reader.uint8(offset);
                            cbData['bytes'].push(parseInt(res.result).toString(16));
                            offset = res.offset;
                        }
                    }

                    block.tx[k].coinbaseData = cbData;
                }

            }

            console.log(block.tx[0]);
            if (block)
                list.push(block);

        }

        return app.rpc.success(list);
    }

    app.rpc.handlers.tx = function (params, cb) {
        let hash = params[0];
        let returnRawData = params[1];

        if (!hash) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, "need one or more hashes")
        } else {

            let tx;
            try {
                tx = app.orwell.consensus.dataManager.getTx(hash);
                if (tx)
                    tx = tx.toJSON('hash,fee,size,height,confirmation,time,fromBlock,hrk');
            } catch (e) {

            }

            if (!tx) {//search in mempool
                tx = app.orwell.mempool.get(hash);
                if (tx)
                    tx.fromMemoryPool = true;
            } else {

                let txk = app.orwell.index.get("tx/" + tx.hash);
                let b = app.orwell.consensus.dataManager.getData(txk.block);
                //tx.confirmation = app.orwell.index.get('top').height - b.height + 1;
                //tx.fromBlock = b.hash;
                //tx.fromIndex = txk.index;
                tx.time = b.time;
            }

            if (!tx)
                return app.rpc.error(app.rpc.INVALID_RESULT, 'havent tx with this hash');

            let tx_in = 0;
            for (let m in tx.in) {
                tx.in[m].writer = tx.s[m][1];
                tx.in[m].writerAddress = app.orwell.ADDRESS.generateAddressFromPublicKey(tx.in[m].writer);
                tx.in[m].sign = tx.s[m][0];

                let prevout = app.orwell.consensus.dataManager.getOut(tx.in[m].hash, tx.in[m].index);
                if (prevout && prevout.amount)
                    tx_in += prevout.amount;

            }

            let tx_out = 0;
            for (let m in tx.out) {
                tx_out += tx.out[m].amount;
            }

            if (tx.cb) {
                tx.coinbaseData = app.orwell.TX.readCoinbaseBytes(tx.cb);
            }

            if (tx.ds) {
                let list = [];
                let a = [];

                if (returnRawData)
                    tx.dslist = [];

                if (tx.coinbase)
                    tx.commonInput = tx.commonOut;

                tx.dataScriptContent = [];
                tx.dataScriptDomain = app.orwell.getDomainAddress(tx.out[0].address);

                if (tx.ds instanceof Array)
                    a = tx.ds;
                else
                    a = dscript.readArray(tx.ds);

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

            let tx2 = tx;
            for (let i in tx2.in) {
                delete tx2.in[i].writer;
                delete tx2.in[i].writerAddress;
                delete tx2.in[i].sign;
            }
            let t = app.orwell.TX.fromJSON(tx);
            tx.hex = t.toHex();
            tx.fee = t.getFee();
            tx.size = t.getSize();

            return app.rpc.success(tx);
        }
    }

    app.rpc.handlers.address = function (params, cb) {
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
    }

    app.rpc.handlers.dblist = function (params, cb) {
        let limit = parseInt(params[0]), offset = parseInt(params[1]);
        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        let arr = app.orwell.getDatabases(limit, offset);
        return app.rpc.success(arr);
    }

    app.rpc.handlers.dbinfo = function (params, cb) {
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
    }

    app.rpc.handlers.records = function (params, cb) {
        let db = params[0], dataset = params[1], limit = parseInt(params[2]), offset = parseInt(params[3]);

        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        return app.rpc.success(app.orwell.getDataSetInfo(db, dataset, limit, offset));
    }

    app.rpc.handlers.mempool = function (params, cb) {
        let list = app.orwell.mempool.getList(), arr = [];
        for (let i in list) {
            let time = app.orwell.mempool.get("time/" + list[i]);
            arr.push({ time: time, hash: list[i] });
        }

        return app.rpc.success(arr);
    }

    app.rpc.handlers.peers = function (params, cb) {
        let peers = app.network.protocol.getNodeList(), peerinfo = {};
        for (let i in peers) {
            let d = app.network.nodes.get("data/" + peers[i]);
            /*if (rinfo.remoteAddress == '127.0.0.1')
                continue;
            */
            d.lastMsg = new Date().getTime() / 1000 - d.lastRecv;
            //peerinfo[rinfo.remoteAddress + "//" + rinfo.port] = d;
            if (d.nodekey)
                peerinfo[d.nodekey] = d;
        }

        return app.rpc.success(peerinfo);
    }

    app.rpc.handlers.tokenHistory = function (params, cb) {
        let ticker = params[0], limit = parseInt(params[1]), offset = parseInt(params[2]);
        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        return app.rpc.success(app.orwell.getTokenHistory(ticker, limit, offset));
    }

    app.rpc.handlers.tokenAddressHistory = function (params, cb) {
        let address = params[0], limit = parseInt(params[1]), offset = parseInt(params[2]);

        if (!app.orwell.ADDRESS.isValidAddress(address))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'not valid address' + address);

        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        return app.rpc.success(app.orwell.getAddressTokenHistory(address, limit, offset));
    }

    app.rpc.handlers.tokenList = (limit, offset) => {
        if (!Number.isFinite(offset) || isNaN(offset))
            offset = 0;

        if (!limit || !Number.isFinite(limit) || isNaN(limit))
            limit = 100;

        if (limit > 1000)
            limit = 1000;

        return app.rpc.success(app.orwell.getTokenList(limit, offset));
    }

    app.rpc.handlers.consensus = () => {
        return app.rpc.success(app.orwell.getConsensus());
    }

    app.rpc.addMethod("help", function (params, cb) {

        let out = "";
        let cliname = 'orw';

        function nl() {
            return "\n";
        }

        out += nl() + (cliname + " client " + app.getAgentName().name + " " + app.getAgentName().version)
        out += nl()
        out += nl() + ("Usage:")
        out += nl() + (cliname + " [option] <command>\tsend command to " + cliname)
        out += nl() + (cliname + " <command> help\t help about command")
        out += nl() + (cliname + " help\t commands list")
        out += nl()
        out += nl() + ("Available Commands:")
        out += nl() + ("> addresses:")
        out += nl() + (cliname + " validateaddress <address>")
        out += nl() + (cliname + " exportprivatekey <address>")
        out += nl() + (cliname + " importprivatekey <privkeyHex> <account name>")
        out += nl() + (cliname + " address <address>")
        out += nl()
        out += nl() + ("> blockchain:")
        out += nl() + (cliname + " bestblockhash")
        out += nl() + (cliname + " parseblock <hex>")
        out += nl() + (cliname + " getinfo")
        out += nl() + (cliname + " chain <limit> <offset>")
        out += nl() + (cliname + " block <hash1 ... hashN>")
        out += nl() + (cliname + " height <index>")
        out += nl() + (cliname + " tx <hash>")
        out += nl() + (cliname + " mempoolinfo")
        out += nl() + (cliname + " reindex")//

        out += nl()
        out += nl() + ("> control:")
        out += nl() + (cliname + " help");
        out += nl() + (cliname + " stop")
        out += nl()
        out += nl() + ("> democracy:")
        out += nl() + (cliname + " democracy.create <type> [paramsjsonarray]")//
        out += nl() + (cliname + " democracy.info <id>")//
        out += nl()
        out += nl() + ("> Network:")
        out += nl() + (cliname + " getconnectioncount")
        out += nl() + (cliname + " getnetworkinfo")
        out += nl() + (cliname + " ping")
        out += nl() + (cliname + " addnode <host> [port]")//
        out += nl()
        out += nl() + ("> Datascript:")
        out += nl() + (cliname + " decodedatascript <hex> [dbname]");
        out += nl() + (cliname + " encodedatascript <json_array_of_dscommand> [dbname]");
        //pack datascript with create command and send tx to network:
        out += nl() + (cliname + " dbinfo <dbname> [dataset] [limit] [offset]");
        out += nl() + (cliname + " dblist [limit] [offset]");
        out += nl() + (cliname + " dbrecords <dbname> [dataset] [limit] [offset]");
        out += nl() + (cliname + " dbcreate <fromaddress> <toaddress> <dataset> <privileges> [is_private=false]"); //is_private - is writeScript. If true - use 0x55 0x60 (that mean check privileges table), else write for all
        out += nl() + (cliname + " dbsettings <fromaddress> <toaddress> <dataset> <settings_json>"); //can change only privileges and writeScript in this version.
        out += nl() + (cliname + " dbwrite <fromaddress> <toaddress> <dataset> <data_json_array>"); //data is array of json_content or json_content. 
        //work with localdb
        out += nl() + (cliname + " syncdb <dbname>")//sync db from blockchain to local database
        out += nl() + (cliname + " cleardb <dbname>")//clear local database
        out += nl()
        out += nl() + ("> Keystore:")
        out += nl() + (cliname + " addpem <path/to/file> <dbname> [datasetname]");//
        out += nl() + (cliname + " rempem <dbname> [datasetname]");//
        out += nl() + (cliname + " getpem <dbname> [datasetname]");//
        //todo: import/export keystore

        out += nl()
        out += nl() + ("> Wallet:")
        out += nl() + (cliname + " balance <account_name>")
        out += nl() + (cliname + " accounthistory <account_name>")
        out += nl() + (cliname + " listaccounts")
        out += nl() + (cliname + " exportprivatekey <address>")
        out += nl() + (cliname + " exportwallet")//
        out += nl() + (cliname + " importwallet <path/from>")//
        out += nl() + (cliname + " importprivkey <private key> [account name]")

        out += nl() + (cliname + " getaccount <address>")
        out += nl() + (cliname + " getaccountaddress <account_name>")
        out += nl() + (cliname + " getaddressesbyaccount <account_name>")
        out += nl() + (cliname + " getnewaddress <account_name>")
        out += nl() + (cliname + " getreceivedbyaccount <account_name> [confirmation=6]")
        out += nl() + (cliname + " getreceivedbyaddress <address> [confirmation=6]")
        out += nl() + (cliname + " listlockunspent ")
        out += nl() + (cliname + " sendfrom <fromaccount> <address> <amount> [datascript]")
        out += nl() + (cliname + " sendtoaddress <address> <amount> [datascript]")

        out += nl()
        out += nl() + ("> Tokens:")
        out += nl() + (cliname + " createtoken <address from> <tokenaddress> <tokenticker> <opts> - opts is json: {\"emission\":\"21000\", \"isStock\":\"false\", \"share\": \"30\", \"title\": \"Token name\"}")
        out += nl() + (cliname + " inittoken <address from> <tokenaddress> <amount> - add emission <amount>")
        out += nl() + (cliname + " createstock <address from> <tokenaddress> <tokenticker> <opts> - opts is json: {\"emission\":\"21000\", \"isStock\":\"false\", \"share\": \"30\", \"title\": \"Token name\"}")
        out += nl() + (cliname + " sendtoken <ticker> <address from> <address to> <amount>")
        out += nl() + (cliname + " gettokenbalance <address from> <ticker>")
        out += nl() + (cliname + " gettokenholders <ticker>")
        out += nl() + (cliname + " gettokenhistory <address from> <ticker>")
        out += nl() + (cliname + " paystockholders <ticker> <address payment from> <amount>")

        out += nl()
        out += nl() + ("> Masternodes:")
        out += nl() + (cliname + " createmasternode <account name>")
        out += nl() + (cliname + " getmasternodes")


        out += nl()
        out += nl() + ("> Domains:")
        out += nl() + (cliname + " createdomain <account name> <domain> <public key>")
        out += nl() + (cliname + " resolvedomain <domain>")//pubkey
        out += nl() + (cliname + " resolvepulickey <public key>")//domain


        out += nl()
        out += nl() + ("> Util:")
        out += nl() + (cliname + " validateaddress <address>");
        out += nl() + (cliname + " initblockchain");

        return cb.apply(this, app.rpc.success(out));
    });


    app.rpc.addMethod('ping', () => {
        return app.rpc.success({ pong: 1 })
    });

    app.rpc.addMethod('stop', () => {
        //TODO: save process stop
        process.exit(0);
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

    app.rpc.addMethod("parseblock", function (params, cb) {
        return app.rpc.success(app.orwell.BLOCK.fromHEX(params[0]));
    });

    app.rpc.addMethod("getinfo", function (params, cb) {
        return app.rpc.success({
            "version": app.cnf("consensus").version,
            "protocolversion": app.cnf("consensus").version,
            "walletversion": app.cnf("agent").version,
            "balance": app.wallet.getBalance(0),
            "blocks": app.orwell.blockpool.blockCount(),
            "timeoffset": 0,
            "connections": app.network.protocol.getNodeList().length,
            "proxy": "",
            "testnet": app.cnf('network') == 'testnet',
            "net": app.cnf('network'),
            "keypoololdest": app.orwell.mempool.getOldest(),
            "keypoolsize": app.orwell.mempool.getCount(),
            "paytxfee": app.wallet.getFee(),//wallet.fee,
            "datasetfee": 0
        }
        );
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

        app.wallet.sendFromAddress(acc.address, to, amount * app.cnf('consensus').satoshi, datascriptHEX)
            .then((result) => {
                cb(result.hash);
            })
            .catch((err) => {
                cb(null, err);
            })

        return -1;
    });

    app.rpc.addMethod("listaccounts", function (params, cb) {

        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        return app.rpc.success(list);
    });

    app.rpc.addMethod("accounthistory", function (params, cb) {
        let id = params[0];

        if (!id)
            id = 0;

        let obj = app.wallet.getAccount(id);
        return app.rpc.success(obj.address);
    });

    app.rpc.addMethod("accountaddress", function (params, cb) {
        let id = params[0];

        if (!id)
            id = 0;

        let obj = app.wallet.getAccount(id);
        return app.rpc.success(obj.address);
    });

    app.rpc.addMethod("exportprivatekey", function (params, cb) {
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

    app.rpc.addMethod("importprivatekey", function (params, cb) {
        let privateKey = params[0];
        let accountName = params[1] || "";
        let obj = app.wallet.importPrivateKey(privateKey, accountName);

        if (!obj || !obj.privateKey)
            return app.rpc.error(app.rpc.INVALID_PARAMS, "need valid and exist address to dump private key");

        let addr = obj.address;
        let pub = obj.publicKey;

        return app.rpc.success({ name: obj.hash, address: addr, publicKey: pub });
    });

    app.rpc.addMethod("balance", function (params, cb) {
        let id = params[0];
        let balance = app.wallet.getBalance(id);
        return app.rpc.success({ balance: balance / app.cnf('consensus').satoshi + 0 });
    });

    app.rpc.addMethod("chain", function (params, cb) {
        return app.rpc.handlers.chain(params, cb);
    });

    app.rpc.addMethod("bestblockhash", function (params, cb) {
        let info = app.orwell.index.getTop();

        if (!info.id)
            info = { hash: app.orwell.GENESIS.hash, height: 0 };
        else
            info.hash = info.id;

        return app.rpc.success(info);
    });

    app.rpc.addMethod("height", (params, cb) => {
        return app.rpc.handlers.block('height', params, cb);
    });

    app.rpc.addMethod("block", function (params, cb) {
        return app.rpc.handlers.block('block', params, cb);
    });


    app.rpc.addMethod("tx", function (params, cb) {
        return app.rpc.handlers.tx(params, cb);
    });

    app.rpc.addMethod("address", function (params, cb) {
        return app.rpc.handlers.address(params, cb);
    });

    app.rpc.addMethod("dbinfo", function (params, cb) {
        return app.rpc.handlers.dbinfo(params, cb);
    });

    app.rpc.addMethod("dblist", function (params, cb) {
        return app.rpc.handlers.dblist(params, cb);
    });

    app.rpc.addMethod("dbrecords", function (params, cb) {
        return app.rpc.handlers.records(params, cb);
    });

    app.rpc.addMethod("peerinfo", function (params, cb) {
        return app.rpc.handlers.peers(params, cb);
    });

    app.rpc.addMethod("mempoolinfo", function (params, cb) {
        return app.rpc.handlers.mempool(params, cb);
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
                    cb(result);
                } else {
                    cb(null, error.message);
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

        app.wallet.sendFromAddress(acc.address, addressTo, 0, hex)
            .then((result, error) => {
                if (result) {
                    cb(result);
                } else {
                    cb(null, error.message);
                }
            })

        return -1;
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
                cb(result);
            })
            .catch((e) => {
                cb(null, e);
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
        if (!app.orwell.ADDRESS.isValidAddress(addrto.address))
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

        app.orwell.createToken(acc, tokenaddress, tokenticker, content)
            .then((hashes) => {
                cb(hashes);
            })
            .catch(e => {
                cb(null, e);
            })

        return -1;

    });

    app.rpc.addMethod("inittoken", (params, cb) => {

        let addressfrom = params[0], tokenaddress = params[1], amount = params[2];
        if (!tokenaddress)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'tokenaddress is required');

        if (!app.orwell.dsIndex.get("token/address/" + tokenaddress)) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'token on this address is not exist');
        }

        let acc = app.orwell.resolveWalletAccount(addressfrom);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address from is not valid account or address. Must exists in your wallet.');

        let addrto = app.orwell.resolveWalletAccount(tokenaddress);
        if (!app.orwell.ADDRESS.isValidAddress(addrto.address))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'Tokenaddress is not valid account or address. Must exists in your wallet.');

        tokenaddress = addrto;

        if (!amount || amount < 1)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'amount > 1 is required');


        app.orwell.initToken(acc, tokenaddress,amount)
            .then((hash) => {
                cb(hash);
            })
            .catch(e => {
                cb(null, e);
            })

        return -1;

    });

    app.rpc.addMethod("createstock", (params, cb) => {

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
        if (!app.orwell.ADDRESS.isValidAddress(addrto.address))
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

        let hashes = [];
        app.orwell.OVM.syncdb(app.orwell.getSystemDb())
            .then(() => {
                return app.orwell.writeDb(acc, app.orwell.getSystemAddress(), 'tokens', [{
                    ticker: tokenticker,
                    address: tokenaddress.address,
                    emission: content.emission,
                    isStock: true,
                    title: content.title || tokenticker,
                    share: content.share > 0 || content.share < 1 ? content.share : 0.3,//30% of income payment used for payments stockholders
                }])

            })
            .then((result, error) => {
                if (!result) return app.rpc.error(app.rpc.INVALID_PARAMS, error.message);
                hashes.push(result);
                return app.orwell.createDb(acc, tokenaddress.address, 'token')
            })
            .then((result, error) => {
                if (!result) return app.rpc.error(app.rpc.INVALID_PARAMS, error.message);
                hashes.push(result);
                return app.orwell.writeDb(acc, tokenaddress.address, 'token', [{//initial pay
                    from: tokenaddress.address,
                    to: tokenaddress.address,
                    amount: content.emission
                }])

            })
            .then((result, error) => {
                if (!result) return app.rpc.error(app.rpc.INVALID_PARAMS, error.message);
                hashes.push(result);
                cb(hashes);
            })
            .catch((err) => {
                cb(null, err);
            })

        return -1;

    });

    app.rpc.addMethod("sendtoken", (params, cb) => {

        let ticker = params[0], addressfrom = params[1], addressto = params[2], amount = params[3];

        if (!addressfrom)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressfrom is required');

        if (!addressto)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addressto is required');

        if (!app.orwell.dsIndex.get("token/" + ticker)) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, ticker + ' is not valid token ticker');
        }

        let acc = app.orwell.resolveWalletAccount(addressfrom);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address from is not valid account or address. Must exists in your wallet.');

        let addrto = app.orwell.resolveAddress(addressto);

        if (!app.orwell.ADDRESS.isValidAddress(addrto))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address to is not valid account or address.');

        app.orwell.sendToken(ticker, acc, addrto, amount)
            .then((hash) => {
                cb(hash);
            })
            .catch((e) => {
                cb(null, e);
            })

        return -1;
    });

    app.rpc.addMethod("gettokenbalance", (params, cb) => {

        let address = params[0], token = params[1];

        if (!address)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address is required');


        let acc = app.orwell.resolveWalletAccount(address);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address from is not valid account or address. Must exists in your wallet.');

        if (token) {

            let addr = app.orwell.dsIndex.get("token/" + token);
            if (!addr) {
                return app.rpc.error(app.rpc.INVALID_PARAMS, token + ' is not valid token ticker');
            }

            return app.rpc.success(app.orwell.getTokenAddressAmount(token, acc.address));

        }

        return app.rpc.success(app.orwell.getTokensAddressAmount(acc.address));
    });

    app.rpc.addMethod("gettokenholders", (params, cb) => {

        let token = params[0];

        if (!token)
            return app.rpc.error(app.rpc.INVALID_PARAMS, token + ' is not valid token ticker');

        return app.rpc.success(app.orwell.dsIndex.getTokenHolders(token));
    });

    app.rpc.addMethod("gettokenhistory", (params, cb) => {

        let address = params[0], token = params[1];

        if (!address)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address is required');


        let acc = app.orwell.resolveWalletAccount(address);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address from is not valid account or address. Must exists in your wallet.');

        if (token) {

            let addr = app.orwell.dsIndex.get("token/" + token);
            if (!addr) {
                return app.rpc.error(app.rpc.INVALID_PARAMS, token + ' is not valid token ticker');
            }

            return app.rpc.success(app.orwell.getTokenAddressHistory(token, acc.address));

        }

        return app.rpc.success(app.orwell.getTokensAddressHistory(acc.address));
    });

    app.rpc.addMethod("paystockholders", (params, cb) => {//create dividends payment

        let ticker = params[0], addresspaymentfrom = params[1], amount = params[2];

        if (!addresspaymentfrom)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'addresspaymentfrom is required');

        if (!app.orwell.dsIndex.get("token/" + ticker)) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, ticker + ' is not valid token ticker');
        }

        let acc = app.orwell.resolveWalletAccount(addresspaymentfrom);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'address from is not valid account or address. Must exists in your wallet.');

        let addressBalance = app.orwell.getAddressBalance(acc.address);
        if (amount > addressBalance || amount <= 0)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'amount must be at address balance');

        app.orwell.payStockHolders(ticker, acc, amount)
            .then((hash) => {
                cb(hash);
            })
            .catch((e) => {
                cb(null, e);
            })

        return -1;
    });

    app.rpc.addMethod("createmasternode", (params, cb) => {

        let masternodeacc = params[0];

        if (!masternodeacc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'masternode account is required');

        let acc = app.orwell.resolveWalletAccount(masternodeacc);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'masternode account is not valid account or address. Must exists in your wallet.');

        let addressBalance = app.orwell.getAddressBalance(acc.address);
        if (addressBalance < app.cnf('consensus').masternodeAmount)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'amount on account must be at least ' + app.cnf('consensus').masternodeAmount + " orwl");

        app.orwell.addMasternode(acc)
            .then((hash) => {
                cb(hash);
            })
            .catch((e) => {
                cb(null, e);
            })

        return -1;
    });

    app.rpc.addMethod("getmasternodes", (params, cb) => {

        return app.rpc.success(app.orwell.dsIndex.getMasternodes());
    });

    app.rpc.addMethod("createdomain", (params, cb) => {

        let acc_id = params[0], domain = params[1], pubkey = params[2];

        if (!acc_id)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'account is required');

        if (!domain)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'domain is required');

        if (!pubkey)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'pubkey is required');

        let acc = app.orwell.resolveWalletAccount(acc_id);
        if (!acc)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'account is not valid account or address. Must exists in your wallet.');

        //if (!app.orwell.ADDRESS.isValidAddress(address))
        //   return app.rpc.error(app.rpc.INVALID_PARAMS, 'address is not valid');

        if (!app.orwell.ADDRESS.isValidDomain(domain))
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'domain is not valid');

        app.orwell.createDomain(acc, domain, pubkey)
            .then((hash) => {
                cb(hash);
            })
            .catch((e) => {
                cb(null, e);
            })

        return -1;
    });

    //consensus masternode fix, only if >=3, else - all
    //resolveDomain
    //findDomainByAddress

    //resync indexes
    app.rpc.addMethod("initblockchain", (params, cb) => {
        //create system db domains 
        //create system db tokens
        //create system db masternodes
        let acc = params[0];
        app.orwell.deploySystemDb(app.wallet.getAccount(acc || "0"))
            .then((hashes) => {
                cb(hashes);
            })
            .catch((e) => {
                cb(null, e);
            });

        return -1;
    });

    app.rpc.addMethod("resolvedomain", (params, cb) => {
        return app.rpc.success(app.orwell.resolveDomain(params[0]));
    });

    app.rpc.addMethod("resolvepublickey", (params, cb) => {
        return app.rpc.success(app.orwell.resolveDomainName(params[0]));
    });

    app.rpc.addMethod("filterlog", (params, cb) => {

        let availables = ['config', 'crypto', 'tools', 'db', 'storage', 'rpc', 'index', 'app', 'orwell', 'validatormanager', 'wallet', 'networkhandler', 'dapps', 'ui', 'network', 'dApps', 'handler', 'error', 'utxo', 'validatormanager/timer'];
        if (!params[0] || params[0] == 'help') {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'read only selected cats, use: filterlog cat1,cat2,...,catN, available cats (all for read all): ' + availables.join(","));
        }

        let commands = [];
        if (params[0] == 'all')
            commands = availables;
        else if (params[0] == 'none')
            commands = [];
        else
            commands = params[0].split(",");

        app.setLogModules(commands);
        return app.rpc.success({ "status": "ok", 'nowRead': commands.join(",") });
    });


    app.rpc.addMethod("decodedatascript", (params, cb) => {

        const dscript = require('orwelldb').datascript;
        let list = [];
        let arr = dscript.readArray(params[0]);
        for (let k in arr) {
            let data = new dscript(arr[k]).toJSON();
            list.push(data);
        }

        return app.rpc.success(list);
    })

    app.rpc.addMethod("encodedatascript", (params, cb) => {
        let data = JSON.parse(params[0]);
        let list = [];
        for (let i in data) {
            let e3 = new dscript(data[i]);
            list.push(e3.toHEX());
        }

        return app.rpc.success(dscript.writeArray(list));
    })

    app.rpc.addMethod("getconnectioncount", (params, cb) => {
        return app.rpc.success(this.nodes.get("connections").length)
    });

    app.rpc.addMethod("getnetworkinfo", (params, cb) => {
        return app.rpc.success({
            mempool: app.orwell.mempool.getCount(),
            blocks: app.orwell.blockpool.blockCount(),
            height: app.orwell.index.get('top').height,
            last_hash: app.orwell.index.get('top').id,
        })
    })

    app.rpc.addMethod("addnode", (params, cb) => {
        app.network.protocol.initNode(params[0].split(":").join("//"));
        return app.rpc.success(true);
    })

    app.rpc.addMethod("cleardb", (params, cb) => {
        let dbname = params[0];

        if (!dbname)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'dbname is required');

        try {
            dbname = app.orwell.ADDRESS.getPublicKeyHashByAddress(dbname).toString('hex');
        } catch (e) {//not valid base58 is catched

        }

        let path = app.cnf('orwelldb').path;
        path = path.replace("%home%", app.config.getLocalHomePath())

        fs.unlinkSync(path + "/" + dbname);
        return app.rpc.success(true);
    })

    app.rpc.addMethod("syncdb", (params, cb) => {

        let dbname = params[0];
        let addr = false;

        if (!dbname)
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'dbname is required');

        try {
            let dbname_ = dbname;
            dbname = app.orwell.ADDRESS.getPublicKeyHashByAddress(dbname).toString('hex');
            addr = dbname_
        } catch (e) {//not valid base58 is catched
            addr = app.orwell.ADDRESS.generateAddressFromPublicKey(dbname);
        }

        app.orwell.OVM.syncdb(dbname)
            .then(() => {
                cb(null, { status: true, "address": addr, "dbname": dbname });
            })
            .catch(e => {
                console.log(e);
                cb(e);
            })

        return -1;
    })

    app.rpc.addMethod("reindex", (params, cb) => {

        app.orwell.reindexLocal()
            .then(() => {
                cb(null, { status: true, "top": app.orwell.index.getTop() });
            })

        return -1;
    })

    app.rpc.addMethod("indexblock", (params, cb) => {

        if (!params.length) {
            return app.rpc.error(app.rpc.INVALID_PARAMS, 'one or more hashes is required');
        }

        app.orwell.indexBlock(params)
            .then(() => {
                cb(null, { status: true, "top": app.orwell.index.getTop() });
            })

        return -1;
    })


}