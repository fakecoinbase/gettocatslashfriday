module.exports = function (app, chain) {

    let dsTools = {
        getDatascriptList: function (dbname, raw, byDataSet) {
            return app.orwell.getDatascriptList(dbname, raw, byDataSet);
        },
        checkfee: function (datascripts_arr, bytesLength, tx) {
            let opfee = 0;
            for (let dataset in datascripts_arr) {
                for (let k in datascripts_arr[dataset]) {
                    opfee += app.cnf('wallet').operationfee[datascripts_arr[dataset][k].operator]
                }
            }

            opfee += bytesLength * app.cnf('consensus').minfeeperbyte;
            let l = tx.out;
            let outamount = 0;
            for (let k in l) {
                let res = l[k].amount;
                outamount += res;
            }

            let inamount = 0;
            for (let k in tx.in) {
                let p = app.orwell.getOut(tx.in[k].hash, tx.in[k].index);
                if (p) {
                    inamount += p.amount;
                }
            }

            return inamount - outamount >= opfee;
        },
        getLastSettings: function (ds, datasetname, list) {
            let lastsett = null, owner = null
            let l = list[datasetname];
            for (let i in l) {
                if (l[i].operator == 'settings' || l[i].operator == 'create') {
                    lastsett = l[i];
                    if (!owner && lastsett.content && lastsett.content.owner_key)
                        owner = lastsett.content.owner_key
                }
            }

            if (!lastsett) {
                for (let i in ds) {
                    if (ds[i].operator == 'settings' || ds[i].operator == 'create') {
                        lastsett = ds[i];
                        if (!owner && lastsett.content && lastsett.content.owner_key)
                            owner = lastsett.content.owner_key
                    }
                }
            }

            if (lastsett && lastsett.content)//hack. Settings does not have owner_key (its little bit a bug)
                lastsett.content.owner_key = owner;

            return lastsett;
        },
        checkOwner: function (ds) {
            if (ds.operator == 'settings') {

                let lastsett = dsTools.getLastSettings(ds.dataset);
                if (!lastsett)//not possible situation (in ordinary way)
                    return false;

                return lastsett.owner_key == pubkey;
            }

            return true;
        },
        checkDomainHistory: function (pubkey, content) {
            let writers = [], l = list['domain'];

            for (let k in l) {
                let history = l[k];
                if (history.operator != 'write')
                    continue;

                if (history.content && history.content.domain == content.domain && history.writer)
                    writers.push(history.writer)
            }

            if (writers.length > 0) {//update
                //check owner or previous writer
                if (writers.indexOf(pubkey) >= 0)
                    return true;
                else {
                    return false;
                }
            }

            return true;//insert
        },
        checkTokenHistory(pubkey, content) {
            let writers = [], l = list['token'];

            for (let k in l) {
                let history = l[k];
                if (history.operator != 'write')
                    continue;

                if (history.content && history.content.ticker == content.ticker && history.writer)
                    writers.push(history.writer)
            }

            if (writers.length > 0) {//update
                //check owner or previous writer
                if (writers.indexOf(pubkey) >= 0)
                    return true;
                else {
                    return false;
                }
            }

            return true;//insert
        },
        isToken(address) {

            let records = app.orwell.dsIndex.getRecords(app.orwell.ADDRESS.getPublicKeyHashByAddress(app.cnf('orwelldb').systemAddress).toString('hex'), 'tokens');
            for (let k in records) {
                if (records[k].mainAddress == address) {
                    return true;
                }
            }

            return false;

        },
        getTokenSettings(address) {
            let records = app.orwell.dsIndex.getRecords(app.orwell.ADDRESS.getPublicKeyHashByAddress(app.cnf('orwelldb').systemAddress).toString('hex'), 'tokens');
            for (let k in records) {
                if (records[k].mainAddress == address) {
                    return records[k];
                }
            }

            return false;

        },
        isValidTokenMessage(settings, datascripts) {


            return true;
        }
    }


    transactions();
    blocks();

    function transactions() {

        //Check syntactic correctness
        chain.TX.VALIDATOR.addRule('syntax', function (validator, context, app_) {
            let tx = this;

            let hex = tx.toHex();
            let tx1 = chain.TX.fromHEX(hex);

            if (tx1.getHash(true) == tx.getHash()) {//generated hash from hex == old hash from checking tx - valid
                return true;
            }

            return validator.addError("Transaction syntax is invalid", 'tx_syntax_invalid');
        });
        //sign verify
        chain.TX.VALIDATOR.addRule('sig', function (validator, context, app_) {
            let tx = this.toJSON();

            let builder = new chain.TX.builder(app);
            builder
                .setVersion(tx.version)
                .setInputs(tx.in)
                .setOutputs(tx.out)
                .setLockTime(tx.lock_time)
                .setSigned(this.toHex());

            if (tx.datascript)
                builder.setDatascript(tx.datascript);

            let result = builder
                .verify()

            if (!result) {
                return validator.addError("Transaction sign is invalid", 'tx_sign_invalid');
            }

            return true;
        });
        //Make sure neither in or out lists are empty
        chain.TX.VALIDATOR.addRule('inout', function (validator, context, app_) {
            let tx = this;

            if (tx.getInputs().length < 1) {
                return validator.addError("Transaction inputs is empty", 'tx_inputs_empty');
            }

            if (tx.getOutputs().length < 1) {
                return validator.addError("Transaction outputs is empty", 'tx_outputs_empty');
            }


            return true;
        });
        //Size in bytes <= MAX_BLOCK_SIZE, size in bytes >= 100[2]
        chain.TX.VALIDATOR.addRule('size', function (validator, context, app_) {
            let tx = this;

            if (tx.getSize() >= app.cnf("consensus").blockSize) {
                return validator.addError("Transaction size is over MAX_BLOCK_SIZE", 'tx_size_big');
            }

            if (tx.getSize() < 100) {
                return validator.addError("Transaction size is smaller than 100 bytes", 'tx_size_less');
            }

            return true;
        });
        //Each output value, as well as the total, must be in legal money range
        chain.TX.VALIDATOR.addRule('outvaluerange', function (validator, context, app_) {
            let tx = this;

            let outs = tx.getOutputs();
            for (let i in outs) {
                //if (outs[i].amount < 1)
                //    return validator.addError("Transaction out[" + i + "] size is less than 1 satoshi", 'tx_out_amount_less');

                if (outs[i].amount > app.cnf("consensus").maxcoins * app.cnf("consensus").satoshi)
                    return validator.addError("Transaction out[" + i + "] size is begger than max coins", 'tx_out_amount_bigger');
            }

            return true;
        });
        //Make sure none of the inputs have hash=0, n=-1 (coinbase transactions)
        chain.TX.VALIDATOR.addRule('invaluecoinbase', function (validator, context, app_) {
            if (!(context.trigger == 'block' && context.index != 0)) {
                let tx = this;

                if (tx.isCoinbase())
                    return true;

                let ins = tx.getInputs();
                for (let i in ins) {
                    if (i == 0)
                        continue;

                    if (ins[i].hash == '0000000000000000000000000000000000000000000000000000000000000000' && ins[i].index == 0xffffffff)
                        return validator.addError("Transaction in[" + i + "] is coinbase", 'tx_in_coinbase');
                }

                return true;
            }
            return true;
        });
        //Check that nLockTime <= INT_MAX[1], and sig opcount <= 2[3]
        chain.TX.VALIDATOR.addRule('locktime', function (validator, context, app_) {
            let tx = this;

            if (tx.lock_time > 2147483647)
                return validator.addError("Transaction lock_time is bigger than INT_MAX", 'tx_locktime_bigger_limit');

            return true;
        });
        //Reject "nonstandard" transactions: scriptSig doing anything other than pushing numbers on the stack, or scriptPubkey not matching the two usual forms[4]
        chain.TX.VALIDATOR.addRule('standartScriptSig', function (validator, context, app_) {
            let tx = this;

            //only Pay To Public Key Hash (P2PKH), Pay To Script Hash (P2SH) or Multisig
            //now implementet only P2PKH, in future: Multisig too
            let ins = tx.getInputs();
            for (let i in ins) {
                if (tx.isCoinbase() && i == 0)
                    continue;
                let out = app.orwell.getOut(ins[i].hash, ins[i].index);

                //todo: out.address maybe too? and for rule: doublespending
                let res = app.orwell.SCRIPT.isP2PKH(new Buffer(out.scriptPubKey || out.script, 'hex'));
                if (!res)
                    return validator.addError("Transaction scriptPubKey is nonstandart", 'tx_scriptsig_nonstandart');
            }

            return true;
        });
        //Reject if we already have matching tx in the pool, or in a block in the main branch
        chain.TX.VALIDATOR.addRule('existTx', function (validator, context, app_) {
            let tx = this;
            let t = tx.toJSON();

            //todo check in mempool
            //todo check in orphan blocks
            if (context.trigger == 'relay') {
                try {
                    let tx = app.orwell.getTx(t.hash).toJSON();
                    if (tx.hash)
                        return validator.addError('tx already exist in blockchain', 'tx_exist');
                } catch (e) {
                }
            }

            return true;
        });

        //For each input, look in the main branch and the transaction pool to find the referenced output transaction. If the output transaction is missing for any input, this will be an orphan transaction. Add to the orphan transactions, if a matching transaction is not in there already.
        chain.TX.VALIDATOR.addRule('missingprevouttx', function (validator, context, app_) {
            let tx = this;

            let outs = tx.getInputs();
            for (let i in outs) {
                if (tx.isCoinbase() && i == 0)
                    continue;

                let prev = app.orwell.getOut(outs[i].hash, outs[i].index);
                //todo: prev.scriptPubKey maybe too?  and for rule: standartScriptSig
                if (!prev.address && !prev.scriptPubKey && !prev.script)
                    return validator.addError('Tx previous out is not finded', 'tx_prevout_missing');

            }

            return true;
        });
        //For each input, if the referenced output exists in any other tx in the pool, reject this transaction.[5]
        //todo: mempool index.

        //For each input, if the referenced output does not exist (e.g. never existed or has already been spent), reject this transaction[6]
        chain.TX.VALIDATOR.addRule('doublespending', function (validator, context, app_) {
            let tx = this.toJSON();

            let ins = tx.in;
            for (let i in ins) {
                if (tx.coinbase && i == 0)
                    continue;

                let prev = app.orwell.getOut(ins[i].hash, ins[i].index);
                if (!prev)
                    return validator.addError('Tx prev out is not exist', 'tx_prevout_missing');
                //todo: prev.scriptPubKey maybe too?  and for rule: standartScriptSig
                let info = app.orwell.utxo.getUTXOInfo(prev.address, ins[i].hash, ins[i].index);
                //console.log(tx, info);
                //console.log(tx.hash, info.spentHash, ins[i].hash)
                //console.log(this.toHex());
                if (!info || (info.spentHash && info.spentHash != tx.hash))
                    return validator.addError('Tx doublespended', 'tx_doublespending');

            }

            return true;
        });
        //For each input, if the referenced output transaction is coinbase (i.e. only 1 input, with hash=0, n=-1), it must have at least COINBASE_MATURITY (100) confirmations; else reject this transaction
        chain.TX.VALIDATOR.addRule('coinbasetx', function (validator, context, app_) {
            let tx = this;

            if (context.trigger == 'relay') {
                let ins = tx.getInputs();
                for (let i in ins) {
                    if (tx.isCoinbase() && i == 0)
                        continue;
                    let prevtx = app.orwell.getTx(ins[i].hash);
                    if (prevtx.coinbase) {
                        let index = prevtx.fromIndex;
                        if (app.orwell.index.getTop().height - index > app.cnf("consensus").maturity) {
                            return validator.addError('Tx coinbase maturity', 'tx_maturity');
                        }

                    }

                }
            }

            return true;
        });
        //Using the referenced output transactions to get input values, check that each input value, as well as the sum, are in legal money range
        chain.TX.VALIDATOR.addRule('refout', function (validator, context, app_) {
            let tx = this;

            let outs = tx.getInputs();
            let outsum = 0;
            for (let i in outs) {
                if (tx.isCoinbase() && i == 0)
                    continue;

                let prev = app.orwell.getOut(outs[i].hash, outs[i].index);
                if (!prev)
                    return validator.addError('Tx prev out is not exist', 'tx_prevout_missing');
                //todo: prev.scriptPubKey maybe too?  and for rule: standartScriptSig

                if (prev.amount < app.cnf("consensus").satoshi)
                    return validator.addError("Transaction in[" + i + "].prevout.amount value is less than 1 satoshi", 'tx_in_prevout_amount_less');

                if (prev.amount > app.cnf("consensus").maxcoins * app.cnf("consensus").satoshi)
                    return validator.addError("Transaction in[" + i + "].prevout.amount value is begger than max coins", 'tx_in_prevout_amount_bigger');

                outsum += prev.amount;
            }

            if (outsum > app.cnf("consensus").maxcoins * app.cnf("consensus").satoshi)
                return validator.addError("Transaction SUM(in.prevout.amount) value is begger than max coins", 'tx_in_sum_amount_bigger');


            return true;
        });
        //Reject if the sum of input values < sum of output values
        //Reject if transaction fee (defined as sum of input values minus sum of output values) would be too low to get into an empty block
        chain.TX.VALIDATOR.addRule('fee', function (validator, context, app_) {
            let sum_in = 0;
            let sum_out = 0;
            let tx_ = this.toJSON();

            let ins = tx_.in;
            for (let i in ins) {
                if (tx_.coinbase && i == 0)
                    continue;

                let prev = app.orwell.getOut(ins[i].hash, ins[i].index);
                if (!prev)
                    return validator.addError('Tx prev out is not exist', 'tx_prevout_missing');

                sum_in += prev.amount;
            }

            let outs = tx_.out;
            for (let i in outs) {
                sum_out += outs[i].amount;
            }

            if (sum_in < sum_out && !tx_.coinbase)
                return validator.addError('Tx sum input and output range is invalid', 'tx_fee_invalid');

            let fee = sum_in - sum_out;
            let size = tx_.size;
            let isCoinbase = tx_.coinbase;

            let cost = fee / size;

            if (cost < app.cnf("consensus").minfeeperbyte && !isCoinbase) {
                return validator.addError('Fee is less then min value2', 'tx_fee_less_min');
            }

            return true;
        });
        //Verify the scriptPubKey accepts for each input; reject if any are bad'
        chain.TX.VALIDATOR.addRule('spendable', function (validator, context, app_) {
            let tx = this;
            let sum_in = 0;
            let sum_out = 0;

            let tx_ = tx.toJSON();

            for (let i in tx_.in) {
                if (tx.isCoinbase() && i == 0)
                    continue;

                let prev = app.orwell.getOut(tx_.in[i].hash, tx_.in[i].index);
                if (!prev)
                    return validator.addError('Tx prev out is not exist', 'tx_prevout_missing');

                let addrhash = app.orwell.SCRIPT.scriptToAddrHash(prev.scriptPubKey || prev.script).toString('hex');
                let pubKey = app.orwell.SCRIPT.sigToArray(tx_.in[i].scriptSig || tx_.in[i].sig).publicKey;
                let address = app.orwell.ADDRESS.generateAddressFromPublicKey(pubKey);
                let addrhashmy = app.orwell.ADDRESS.getPublicKeyHashByAddress(address).toString('hex');
                let res = addrhashmy == addrhash

                if (!res) {
                    return validator.addError('Tx scriptSig is not spendable', 'tx_unspendable');
                }

            }

            return true;
        });
        ////Add to transaction pool[7]
        //"Add to wallet if mine"
        //Relay transaction to peers
        //For each orphan transaction that uses this one as one of its inputs, run all these steps (including this one) recursively on that orphan


        //datascript check

        //ds_countisvalid
        //dbisexist
        //settingsCanChangeOnlyOwner
        //createOnlyOnce
        //canWrite
        //canEdit
        //dsfee 
        //domaincheck

        //same count raw ds and unserialized
        chain.TX.VALIDATOR.addRule('ds_count', function (validator, context, app_) {
            let tx = this;
            let tx_ = tx.toJSON();


            if (!tx_.datascript)
                return true;

            let arr = tx_.datascript || [];
            let res = arr.length == tx.preparedDS.count;
            if (!res)
                return validator.addError('Invalid count datascript: ' + arr.length + ' - ' + tx.preparedDS.count, 'ds_count_invalid');
            return res;
        });

        //
        chain.TX.VALIDATOR.addRule('dbisexist', function (validator, context, app_) {
            let tx = this.toJSON();

            if (!tx.datascript)
                return true;

            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;

            //get all ds list to this db
            //check - first ds !!!must be create only!!!
            //transaction with datascript ins:
            //0 - one input with scriptSig, which contain pubkey from privileges
            //transaction with datascripts outs:
            //0 - destination db with amount > opfee
            //1 - change
            let res = [];

            for (let datasetname in datascripts) {
                let ds = datascripts[datasetname];

                let first = null;
                if (list[datasetname] && list[datasetname].length) {
                    first = list[datasetname][0];
                } else {
                    first = ds[0];
                }

                if (first.operator != 'create') {
                    res.push(0);
                    return validator.addError("datascript[" + i + "] dataset " + datasetname + " already created correctly: false", 'ds_incorrect_creation');
                } else
                    res.push(1);

            }


            let sum = 0;
            for (let i in res) {
                sum += res[i];
            }

            return sum == res.length


        });

        chain.TX.VALIDATOR.addRule('settingsCanChangeOnlyOwner', function (validator, context, app_) {
            let tx = this.toJSON();

            if (!tx.datascript)
                return true;

            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;

            let res = [];

            for (let datasetname in datascripts) {
                let ds = datascripts[datasetname];

                for (let k in ds) {

                    if (ds[k] == 'settings') {

                        if (!dsTools.checkOwner(ds[k])) {
                            res.push(0);
                            return validator.addError("datascript[" + i + "].settings changed by owner: false", 'ds_settings_change_onlyowner');
                        } else
                            res.push(1);

                    }

                }

            }


            let sum = 0;
            for (let i in res) {
                sum += res[i];
            }

            return sum == res.length
        });

        chain.TX.VALIDATOR.addRule('createOnlyOnce', function (validator, context, app_) {

            let tx = this.toJSON();
            if (!tx.datascript)
                return true;


            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;

            let res = [];
            for (let datasetname in datascripts) {
                let ds = datascripts[datasetname];

                let findedCreate = 0;
                for (let k in ds) {
                    if (ds[k].operator == 'create')
                        findedCreate++;
                }

                let findedInDB = false;
                if (list[datasetname]) {
                    let first = list[datasetname][0];
                    if (first && first.operator == 'create')
                        findedInDB = true;
                }

                if (findedInDB) {
                    if (findedCreate == 0) {
                        res.push(1);
                    } else {
                        return validator.addError("datascript in dataset " + datasetname + " is create op, have in db: true, have in ds only one: false");
                        res.push(0);
                    }
                } else {
                    if (findedCreate == 1) {
                        res.push(1);
                    } else {
                        res.push(0)
                        return validator.addError("datascript in dataset " + datasetname + " is create op, have in db: false, have in ds only one: false");
                    }
                }

            }

            let sum = 0;
            for (let i in res) {
                sum += res[i];
            }

            return sum == res.length

        });

        chain.TX.VALIDATOR.addRule('canWrite', function (validator, context, app_) {
            let tx = this.toJSON();
            if (!tx.datascript)
                return true;

            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;


            let res = [];
            for (let datasetname in datascripts) {
                let ds = datascripts[datasetname];
                let lastsett = dsTools.getLastSettings(ds, datasetname, list);


                if (!lastsett) {
                    return validator.addError("datascript.lastsettings (settings or create script) found: false", 'ds_settings_not_found');
                    res.push(0);
                    continue;
                }

                if (!lastsett.content) {
                    return validator.addError("datascript.lastsettings.content not empty: false", 'ds_settings_empty');
                    res.push(0);
                    continue;
                }

                if (!lastsett.content.writeScript) {
                    res.push(1);
                    continue;
                }

                if ((lastsett.content.writeScript == '5560' || lastsett.content.writeScript == 5560)) {
                    if ((lastsett.content.privileges.indexOf(pubkey) >= 0 || lastsett.content.owner_key == pubkey)) {
                        res.push(1);
                        continue;
                    } else {
                        return validator.addError("datascript.writeScript rule x55 x60 - can write only owner success: false", 'ds_canwrite_onlyowner');
                        res.push(0);
                        continue;
                    }
                } else if (!lastsett.content.writeScript)
                    res.push(1);
            }



            let sum = 0;
            for (let i in res) {
                sum += res[i];
            }

            return sum == res.length

        });


        chain.TX.VALIDATOR.addRule('canEdit', function (validator, context, app_) {
            let tx = this.toJSON();
            if (!tx.datascript)
                return true;

            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;

            //if entry is exist in db, and send this entry with similar oid - check, 
            //that previously sender send data (or owner|have privileges). And for writeScript = '' TOO!
            let res = [];

            for (let datasetname in datascripts) {
                let ds = datascripts[datasetname];
                let lastsett = dsTools.getLastSettings(ds, datasetname, list);

                if (!lastsett) {
                    return validator.addError("dataset[" + datasetname + "] found dataset_settings: false", 'ds_settings_not_found');
                    res.push(0)
                    continue;
                }

                if (!list[datasetname] || !list[datasetname].length)
                    continue;//no have history, havent edit yet

                for (let i in ds) {
                    let writers = [];
                    if (ds[i].operator == 'write' && ds[i].content) {//only with public datascript. Private datascripts dont check with this rule.
                        for (let k in list[datasetname]) {
                            let history = list[datasetname][k];
                            if (history.operator != 'write')
                                continue;

                            if (history.content && history.content.oid == ds[i].content.oid && history.writer) {
                                writers.push(history.writer)
                            }
                        }

                        if (writers.length > 0) {
                            //check owner or previous writer
                            if (writers.indexOf(pubkey) >= 0 || lastsett.content.privileges.indexOf(pubkey) >= 0 || lastsett.content.owner_key == pubkey)
                                res.push(1);
                            else {
                                res.push(0);
                                return validator.addError("datascript[" + i + "] edit can only owner, or privileged keys or previous writer: false", 'ds_canedit_access');
                            }
                        }
                    }
                }


            }

            let sum = 0;
            for (let i in res) {
                sum += res[i];
            }

            return sum == res.length
        });

        chain.TX.VALIDATOR.addRule('dsopfee', function (validator, context, app_) {
            let tx = this.toJSON();
            if (!tx.datascript)
                return true;


            let dbname = this.preparedDS.dbname;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let res = dsTools.checkfee(this.preparedDS.data, new Buffer(this.toHex(), 'hex').length, tx);
            if (!res)
                return validator.addError("datascript opfee valid: false", 'ds_fee_invalid');

            return res;
        });

        //domains
        chain.TX.VALIDATOR.addRule('domains', function (validator, context, app_) {
            let tx = this.toJSON();
            if (!tx.datascript)
                return true;


            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;

            let res = [];
            if (dbname == chain.getSystemDb()) {//special rule for this db/domain

                for (let datasetname in datascripts) {
                    if (datasetname == 'domain') {

                        let ds = datascripts[datasetname];
                        for (let k in ds) {

                            if (ds[k].operator == 'write' && ds[k].content) {
                                let content = ds[k].content;
                                //now we in db system/domain and ds[k].content is try to write in this db
                                //we need, that format of entry will be valid {oid: 'somehex', domain: 'something regexp', address: 'validaddress'}
                                //and if address with this entry already have - check that previous writer change it.
                                if (!content.domain || !content.address) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] valid domain entry format: false", 'domain/domainformatinvalid');
                                    continue;
                                }

                                if (!chain.ADDRESS.isValidAddress(content.address)) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] valid address format: false", 'domain/addressformatinvalid');
                                    continue;
                                }

                                if (!chain.ADDRESS.isValidDomain(content.domain)) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] valid domain format: false", 'domain/domainformatinvalid');
                                    continue;
                                }

                                if (!dsTools.checkDomainHistory(pubkey, content)) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] can edit domain: false", 'domain/canteditdomain');
                                    continue;
                                }

                                let addrdomain = chain.dsIndex.get("domain/" + content.domain);
                                let domainaddr = chain.dsIndex.get("domain/address/" + content.address);
                                if (addrdomain && addrdomain != content.address) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] address already have domain: false", 'domainaddress/alreadyexist');
                                }

                                if (domainaddr && domainaddr != content.domain) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] domain already have address: false", 'addressdomain/alreadyexist');
                                }


                            }

                        }



                    }

                }

            }

            let sum = 0;
            for (let i in res) {
                sum += res[i];
            }

            return sum == res.length

        });

        //tokens
        chain.TX.VALIDATOR.addRule('addtokens', function (validator, context, app_) {
            let tx = this.toJSON();
            if (!tx.datascript)
                return true;


            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;

            let res = [];
            if (dbname == chain.getSystemDb()) {//special rule for this db/domain

                for (let datasetname in datascripts) {
                    if (datasetname == 'tokens') {

                        let ds = datascripts[datasetname];
                        for (let k in ds) {

                            if (ds[k].operator == 'write' && ds[k].content) {
                                let content = ds[k].content;
                                //now we in db system/token and ds[k].content is try to write in this db
                                //we need, that format of entry will be valid {oid: 'somehex', ticker: 'uniq token id', title: 'token name', emission: 'count of tokens', mainAddress: 'address of token db', mainHolder: 'pubkey of main holder', isStock: 'true or false'}
                                //and if address with this entry already have - check that previous writer change it.
                                if (!content.ticker || !content.title) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] valid token entry format: false", 'token/tokenformatinvalid');
                                }

                                if (!chain.ADDRESS.isValidDomain(content.ticker) || content.ticker.length < 2 || content.ticker > 64) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] valid ticker entry format: false", 'token/tickerformatinvalid');
                                }

                                if (!chain.ADDRESS.isValidAddress(content.mainAddress)) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] valid address format: false", 'domain/mainaddressformatinvalid');
                                }

                                if (content.emission <= 0) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] valid token emission format: false", 'token/emission');
                                }

                                if (!dsTools.checkTokenHistory(pubkey, content)) {
                                    res.push(0);
                                    return validator.addError("datascript[" + k + "] can edit token: false", 'token/cantedittoken');
                                }


                            }

                        }

                    }

                }

            }

            let sum = 0;
            for (let i in res) {
                sum += res[i];
            }

            return sum == res.length

        });

        chain.TX.VALIDATOR.addRule('tokens', function (validator, context, app_) {
            let tx = this.toJSON();
            if (!tx.datascript)
                return true;


            let dbname = this.preparedDS.dbname;
            let pubkey = this.preparedDS.writer_key;
            let list = dsTools.getDatascriptList(dbname, false, true);
            let datascripts = this.preparedDS.data;

            let tokenSett = dsTools.getTokenSettings(dbname);
            if (!tokenSett)//is not token
                return true;

            for (let datasetname in datascripts) {
                if (datasetname == 'token') {

                    let ds = datascripts[datasetname];
                    for (let k in ds) {

                        if (ds[k].operator == 'write' && ds[k].content) {
                            let content = ds[k].content;

                            if (!content.to || !chain.ADDRESS.isValidAddress(content.to)) {
                                res.push(0);
                                return validator.addError("datascript[" + k + "] token message valid: false", 'token/messageinvalid');
                            }

                            if (!content.from || !chain.ADDRESS.isValidAddress(content.from)) {
                                res.push(0);
                                return validator.addError("datascript[" + k + "] token message valid: false", 'token/messageinvalid');
                            }

                            if (content.amount <= 0 || content.amount > settings.emission) {
                                res.push(0);
                                return validator.addError("datascript[" + k + "] token message valid: false", 'token/messageinvalid');
                            }

                            //check token balance on account writer
                            let balance = chain.getTokenAmount(dbname, pubkey);
                            if (content.from == chain.ADDRESS.generateAddressFromPublicKey(pubkey) && balance <= 0) {
                                res.push(0);
                                return validator.addError("datascript[" + k + "] token balance valid: false", 'token/balance');
                            }

                            let lastsett = dsTools.getLastSettings(ds, datasetname, list);
                            if (content.from == content.to && lastsett.owner_key != pubkey //its seems like a initial pay, writer is owner
                                && content.to != chain.ADDRESS.generateAddressFromAddrHash(dbname) //writer is owner
                                && !chain.getTokenAmount(dbaddress, pubkey)) {//no have balance for writer
                                res.push(0);
                                return validator.addError("datascript[" + k + "] from can not be equal to", 'token/fromto');
                            }

                            //not have token for this address
                            //available ticker

                            return true;
                        }
                    }
                }
            }

        });
        //stock
        //masternodes
    }

    function blocks() {

        //1. Check syntactic correctness 
        chain.BLOCK.VALIDATOR.addRule('syntax', function (validator, context, app_) {
            let block = this;

            let hex = block.toHex();
            let b = chain.BLOCK.fromHEX(hex);

            if (b.getHash('raw').toString('hex') == b.getHash()) {//generated hash from hex == old hash from checking tx - valid
                return true;
            }

            return validator.addError("Block syntax is invalid", 'block_syntax_invalid');
        });
        //2. Reject if duplicate of block we have in any of the three categories
        chain.BLOCK.VALIDATOR.addRule('duplicate', function (validator, context, app_) {
            let block = this;

            if (context.trigger == 'relay') {
                try {
                    let b = chain.getBlock(block.getHash());
                    if (b.getHash() == block.getHash())
                        return validator.addError("Block already exist", 'block_duplicate');
                } catch (e) {

                }
            }

            //orphan index check
            return true;
        });
        //3. Transaction list must be non-empty
        chain.BLOCK.VALIDATOR.addRule('blocktxlist', function (validator, context, app_) {
            let block = this;

            if (block.vtx.length < 1)
                return validator.addError("Block txlist empty", 'block_txlist_empty');

            return true;
        });
        //4. Block hash must satisfy claimed nBits proof of work
        chain.BLOCK.VALIDATOR.addRule('hashvalid', function (validator, context, app_) {
            let block = this;

            if (!app.orwell.checkHash(this.app.tools.reverseBuffer(block.getHash('raw')), block.bits)) {
                return validator.addError("Block hash invalid", 'block_hash_invalid');
            }

            return true;
        });
        //5. Block timestamp must not be more than two hours in the future
        chain.BLOCK.VALIDATOR.addRule('blocktimestamp', function (validator, context, app_) {
            let block = this;

            if (block.time >= (Date.now() / 1000 + 2 * 60 * 60)) {
                return validator.addError("Block time invalid or system time is wrong", 'block_time_invalid');
            }

            let prevblock = app.orwell.getBlock(block.prev || block.hashPrevBlock);
            if (block.time < prevblock.time) {
                return validator.addError("Block time invalid, prevtime > block.time", 'block_time_prevblock_invalid');
            }

            return true;
        });
        //6. First transaction must be coinbase (i.e. only 1 input, with hash=0, n=-1), the rest must not be
        chain.BLOCK.VALIDATOR.addRule('block_coinbase', function (validator, context, app_) {
            let block = this;

            let ctx = block.vtx[0].toJSON();
            if (!ctx.coinbase)
                return validator.addError("Block coinbase transaction missing", 'block_coinbase_invalid');

            return true;
        });
        //7. For each transaction, apply "tx" checks 2-4
        chain.BLOCK.VALIDATOR.addRule('block_txlist', function (validator, context, app_) {
            let block = this;

            let res = true;
            for (let i in block.vtx) {
                let tx = block.vtx[i];
                //verify tx, set res=false is tx is invalid
                if (!tx.isValid()) {
                    res = false;
                    return validator.addError("Tx #" + i + " in block is invalid", 'block_tx_invalid');
                }

            }

            return res;
        });

        //16.2 Reject if coinbase value > sum of block creation fee and transaction fees
        //8. For the coinbase (first) transaction, scriptSig length must be 2-100
        //8. Remark: for the coinbase transaction scriptSig is sig, but datascript is coinbaseBytes. Check coinbaseBytes:
        //var_str(author of block), var_str (sofrware,hardware), uint32(time), var_int(vector count), vector_uint8(signal bytes)
        chain.BLOCK.VALIDATOR.addRule('block_coinbase_sig', function (validator, context, app_) {
            let block = this;

            let res = true;
            let coinbase = block.vtx[0];
            //if (coinbase.in[0].scriptSig.length > 200)
            //    return validator.addError("Coinbase tx.in.scriptsig is overlength", 'block_coinbase_invalid');

            let fullfee = 0, amount = 0;
            for (let i in block.vtx) {

                let tx = block.vtx[i].toJSON();
                let sum_in = 0;
                let sum_out = 0;

                let ins = tx.in;
                for (let k in ins) {
                    if (k == 0 && tx.coinbase)
                        continue;

                    let prev = app.orwell.getOut(ins[k].hash, ins[k].index);
                    if (!prev)
                        return validator.addError('Tx prev out is not exist', 'tx_prevout_missing');

                    sum_in += prev.amount;
                }

                let outs = tx.out;
                for (let k in outs) {
                    sum_out += outs[k].amount;
                }

                if (sum_in < sum_out && !tx.coinbase)
                    return validator.addError('Tx sum input and output range is invalid', 'tx_fee_invalid');

                let fee = sum_in - sum_out;
                //let t = tx;
                let size = tx.size;

                let cost = fee / size;
                if (cost < app.cnf("consensus").minfeeperbyte && !tx.coinbase) {
                    return validator.addError('Fee is less then min value1', 'tx_fee_less_min');
                }

                if (!tx.coinbase)
                    fullfee += fee;

            }

            let cbs = coinbase.toJSON();
            for (let i in cbs.out) {
                amount += cbs.out[i].amount;
            }

            if (amount < app.orwell.getBlockValue(fullfee, (context.height || block.height))) {
                return validator.addError("Coinbase amount is less then minimum blockValue for height: " + (context.height || block.height), 'block_coinbase_amount_invalid');
            }

            return res;
        });
        //9. Reject if sum of transaction sig opcounts > MAX_BLOCK_SIGOPS
        //NO
        //10. Verify Merkle hash
        chain.BLOCK.VALIDATOR.addRule('block_merkle', function (validator, context, app_) {
            let block = this;

            let hashes = [];
            for (let i in block.vtx) {
                let tx = block.vtx[i];
                //verify tx, set res=false is tx is invalid
                hashes.push(tx.getHash());
            }

            return app.tools.merkleTree(hashes) == block.hashMerkleRoot;
        });
        //11. Check if prev block (matching prev hash) is in main branch or side branches. If not, add this to orphan blocks, then query peer we got this from for 1st missing orphan block in prev chain; done with block
        chain.BLOCK.VALIDATOR.addRule('block_prev_mainchain', function (validator, context, app_) {
            let block = this;
            let prev = null;

            if (app.cnf('consensus').genesisMode)
                return true;

            if (block.hash == chain.GENESIS.hash && block.hashPrevBlock == '0000000000000000000000000000000000000000000000000000000000000000')
                return true;

            try {
                prev = chain.getBlock(block.hashPrevBlock);
            } catch (e) {

            }

            //consensusjs must handle this before
            if (prev && prev.hash)
                return true;
            else
                return validator.addError("Prev block is not exist in any pool", 'block_prev_missing');

        });
        //12. Check that nBits value matches the difficulty rules
        chain.BLOCK.VALIDATOR.addRule('bitsvalid', function (validator, context, app_) {
            let block = this;

            if (block.bits < chain.getDiffForHeight(block.height || context.height)) {
                return validator.addError("Block bits invalid", 'block_bits_invalid');
            }

            return true;
        });
        //13. Reject if timestamp is the median time of the last 11 blocks or before
        chain.BLOCK.VALIDATOR.addRule('mediantimevalid', function (validator, context, app_) {
            let block = this;

            if (app.cnf('consensus').genesisMode)
                return true;

            if (block.time <= chain.getTimeForHeight(block.height - 1)) {
                return validator.addError("Block time invalid", 'block_time_invalid');
            }

            return true;
        });
        //14. For certain old blocks (i.e. on initial block download) check that hash matches known values (checkpoints)
        chain.BLOCK.VALIDATOR.addRule('checkpoint', function (validator, context, app_) {
            let block = this;

            if (chain.checkpoint[context.height || block.height] && chain.checkpoint[context.height || block.height] != block.hash) {
                return validator.addError("Block is not equal for checkpoint on height: " + (context.height || block.height), 'checkpoint_invalid');
            }

            return true;
        });
        //15. Add block into the tree. There are three cases: 1. block further extends the main branch; 2. block extends a side branch but does not add enough difficulty to make it become the new main branch; 3. block extends a side branch and makes it the new main branch.
        //16. For case 1, adding to main branch:

        //THIS1 HAVE IN tx.validate section:
        //16.1.1 For all but the coinbase transaction, apply the following:
        //16.1.2 For each input, look in the main branch to find the referenced output transaction. Reject if the output transaction is missing for any input.
        //16.1.3 For each input, if we are using the nth output of the earlier transaction, but it has fewer than n+1 outputs, reject.
        //16.1.4 For each input, if the referenced output transaction is coinbase (i.e. only 1 input, with hash=0, n=-1), it must have at least COINBASE_MATURITY (100) confirmations; else reject.
        //16.1.5 Verify crypto signatures for each input; reject if any are bad
        //16.1.6 For each input, if the referenced output has already been spent by a transaction in the main branch, reject
        //16.1.7 Using the referenced output transactions to get input values, check that each input value, as well as the sum, are in legal money range
        //16.1.8 Reject if the sum of input values < sum of output values
        //END OF THIS1

        //16.3 (If we have not rejected):
        //16.4 For each transaction, "Add to wallet if mine"
        //16.5 For each transaction in the block, delete any matching transaction from the transaction pool
        //16.6 Relay block to our peers
        //16.7 If we rejected, the block is not counted as part of the main branch

        //case 2 and 3 is maked in chain.orphan module.
        //17. For case 2, adding to a side branch, we don't do anything.
        //18. For case 3, a side branch becoming the main branch:
        //18.1 Find the fork block on the main branch which this side branch forks off of
        //18.2 Redefine the main branch to only go up to this fork block
        //18.3 For each block on the side branch, from the child of the fork block to the leaf, add to the main branch:
        //18.3.1 Do "branch" checks 3-11
        //18.3.2 For all but the coinbase transaction, apply the following:
        //18.3.2.1 For each input, look in the main branch to find the referenced output transaction. Reject if the output transaction is missing for any input.
        //18.3.2.2 For each input, if we are using the nth output of the earlier transaction, but it has fewer than n+1 outputs, reject.
        //18.3.2.3 For each input, if the referenced output transaction is coinbase (i.e. only 1 input, with hash=0, n=-1), it must have at least COINBASE_MATURITY (100) confirmations; else reject.
        //18.3.2.4 Verify crypto signatures for each input; reject if any are bad
        //18.3.2.5 For each input, if the referenced output has already been spent by a transaction in the main branch, reject
        //18.3.2.6 Using the referenced output transactions to get input values, check that each input value, as well as the sum, are in legal money range
        //18.3.2.7 Reject if the sum of input values < sum of output values
        //18.3.3 Reject if coinbase value > sum of block creation fee and transaction fees
        //18.3.4 (If we have not rejected):
        //18.3.5 For each transaction, "Add to wallet if mine"
        //18.4 If we reject at any point, leave the main branch as what it was originally, done with block
        //18.5 For each block in the old main branch, from the leaf down to the child of the fork block:
        //18.5.1 For each non-coinbase transaction in the block:
        //18.5.1.1 Apply "tx" checks 2-9, except in step 8, only look in the transaction pool for duplicates, not the main branch
        //18.5.1.2 Add to transaction pool if accepted, else go on to next transaction
        //18.6 For each block in the new main branch, from the child of the fork node to the leaf:
        //18.6.1 For each transaction in the block, delete any matching transaction from the transaction pool
        //18.7 Relay block to our peers
        //19 For each orphan block for which this block is its prev, run all these steps (including this one) recursively on that orphan


    }

}


