module.exports = function (app, chain) {

    transactions();
    blocks();

    function transactions() {

        //Check syntactic correctness
        chain.TX.VALIDATOR.addRule('syntax', function (validator, context, app_) {
            let tx = this;

            let hex = tx.toHEX();
            let tx = chain.TX.fromHEX(app, hex);

            if (tx.getHash(true) == tx.getHash()) {//generated hash from hex == old hash from checking tx - valid
                return true;
            }

            app.throwError("Transaction syntax is invalid", 'tx_syntax_invalid');
        });
        //Make sure neither in or out lists are empty
        chain.TX.VALIDATOR.addRule('inout', function (validator, context, app_) {
            let tx = this;

            if (tx.getInputs() < 1) {
                app.throwError("Transaction inputs is empty", 'tx_inputs_empty');
            }

            if (tx.getOutputs() < 1) {
                app.throwError("Transaction outputs is empty", 'tx_outputs_empty');
            }


            return true;
        });
        //Size in bytes <= MAX_BLOCK_SIZE, size in bytes >= 100[2]
        chain.TX.VALIDATOR.addRule('size', function (validator, context, app_) {
            let tx = this;

            if (tx.getSize() >= app.cnf("consensus").blockSize) {
                app.throwError("Transaction size is over MAX_BLOCK_SIZE", 'tx_size_big');
            }

            if (tx.getSize() < 100) {
                app.throwError("Transaction size is smaller than 100 bytes", 'tx_size_less');
            }

            return true;
        });
        //Each output value, as well as the total, must be in legal money range
        chain.TX.VALIDATOR.addRule('outvaluerange', function (validator, context, app_) {
            let tx = this;

            let outs = tx.getOutputs();
            for (let i in outs) {
                if (outs[i].amount < app.cnf("consensus").satoshi)
                    app.throwError("Transaction out[" + i + "] size is less than 1 satoshi", 'tx_out_amount_less');

                if (outs[i].amount > app.cnf("consensus").maxcoins * app.cnf("consensus").satoshi)
                    app.throwError("Transaction out[" + i + "] size is begger than max coins", 'tx_out_amount_bigger');
            }

            return true;
        });
        //Make sure none of the inputs have hash=0, n=-1 (coinbase transactions)
        if (context.trigger == 'block' && context.index != 0)
            chain.TX.VALIDATOR.addRule('invaluecoinbase', function (validator, context, app_) {
                let tx = this;

                let ins = tx.getInputs();
                for (let i in ins) {

                    if (ins[i].hash == '0000000000000000000000000000000000000000000000000000000000000000' && ins[i].index == 0xffffffff)
                        app.throwError("Transaction in[" + i + "] is coinbase", 'tx_in_coinbase');
                }

                return true;
            });
        //Check that nLockTime <= INT_MAX[1], and sig opcount <= 2[3]
        chain.TX.VALIDATOR.addRule('locktime', function (validator, context, app_) {
            let tx = this;

            if (tx.lock_time > 2147483647)
                app.throwError("Transaction lock_time is bigger than INT_MAX", 'tx_locktime_bigger_limit');

            return true;
        });
        //Reject "nonstandard" transactions: scriptSig doing anything other than pushing numbers on the stack, or scriptPubkey not matching the two usual forms[4]
        chain.TX.VALIDATOR.addRule('standartScriptSig', function (validator, context, app_) {
            let tx = this;

            //only Pay To Public Key Hash (P2PKH), Pay To Script Hash (P2SH) or Multisig
            //now implementet only P2PKH, in future: Multisig too
            let ins = tx.getInputs();
            for (let i in ins) {
                let out = app.btcchain.getOut(ins[i].hash, ins[i].index);
                //todo: out.address maybe too? and for rule: doublespending
                let res = app.btcchain.SCRIPT.isP2PKH(app, new Buffer(out.scriptPubKey, 'hex'));
                if (!res)
                    app.throwError("Transaction scriptSig is nonstandart", 'tx_scriptsig_nonstandart');
            }

            return true;
        });
        //Reject if we already have matching tx in the pool, or in a block in the main branch
        chain.TX.VALIDATOR.addRule('existTx', function (validator, context, app_) {
            let tx = this;

            //todo check in mempool
            //todo check in orphan blocks
            if (context.trigger == 'relay') {
                try {
                    let tx = app.btcchain.getTx(this.getHash());
                    if (tx.hash)
                        app.throwError('tx already exist in blockchain', 'tx_exist');
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
                let prev = app.btcchain.getOut(outs[i].hash, outs[i].index);
                //todo: prev.scriptPubKey maybe too?  and for rule: standartScriptSig
                if (!prev.address && !prev.scriptPubKey)
                    app.throwError('Tx previous out is not finded', 'tx_prevout_missing');

            }

            return true;
        });
        //For each input, if the referenced output exists in any other tx in the pool, reject this transaction.[5]
        //todo: mempool index.

        //For each input, if the referenced output does not exist (e.g. never existed or has already been spent), reject this transaction[6]
        chain.TX.VALIDATOR.addRule('doublespending', function (validator, context, app_) {
            let tx = this;

            let outs = tx.getInputs();
            for (let i in outs) {
                let prev = app.btcchain.getOut(outs[i].hash, outs[i].index);
                if (!prev)
                    app.throwError('Tx prev out is not exist', 'tx_prevout_missing');
                //todo: prev.scriptPubKey maybe too?  and for rule: standartScriptSig
                let info = app.btcchain.utxo.getUTXOInfo(prev.address, outs[i].hash, outs[i].index);
                if (!info || info.spentHash != '')
                    app.throwError('Tx doublespended', 'tx_doublespending');

            }

            return true;
        });
        //For each input, if the referenced output transaction is coinbase (i.e. only 1 input, with hash=0, n=-1), it must have at least COINBASE_MATURITY (100) confirmations; else reject this transaction
        chain.TX.VALIDATOR.addRule('coinbasetx', function (validator, context, app_) {
            let tx = this;

            if (context.trigger == 'relay') {
                let ins = tx.getInputs();
                for (let i in ins) {
                    let prevtx = app.btcchain.getTx(ins[i].hash);
                    if (prevtx.coinbase) {
                        let index = prevtx.fromIndex;
                        if (app.btcchain.index.getTop().height - index > app.cnf("consensus").maturity) {
                            app.throwError('Tx coinbase maturity', 'tx_maturity');
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
            for (let i in outs) {
                let prev = app.btcchain.getOut(outs[i].hash, outs[i].index);
                if (!prev)
                    app.throwError('Tx prev out is not exist', 'tx_prevout_missing');
                //todo: prev.scriptPubKey maybe too?  and for rule: standartScriptSig

                if (prev.amount < app.cnf("consensus").satoshi)
                    app.throwError("Transaction in[" + i + "].prevout.amount size is less than 1 satoshi", 'tx_in_prevout_amount_less');

                if (prev.amount > app.cnf("consensus").maxcoins * app.cnf("consensus").satoshi)
                    app.throwError("Transaction in[" + i + "].prevout.amount size is begger than max coins", 'tx_in_prevout_amount_bigger');

            }

            return true;
        });
        //Reject if the sum of input values < sum of output values
        //Reject if transaction fee (defined as sum of input values minus sum of output values) would be too low to get into an empty block
        chain.TX.VALIDATOR.addRule('fee', function (validator, context, app_) {
            let tx = this;
            let sum_in = 0;
            let sum_out = 0;

            let ins = tx.getInputs();
            for (let i in ins) {
                let prev = app.btcchain.getOut(ins[i].hash, ins[i].index);
                if (!prev)
                    app.throwError('Tx prev out is not exist', 'tx_prevout_missing');

                sum_in += prev.amount;

            }

            let outs = tx.getOutputs();
            for (let i in outs) {
                sum_out += outs[i].amount;
            }

            if (sum_in < sum_out)
                app.throwError('Tx sum input and output range is invalid', 'tx_fee_invalid');

            let fee = sum_in - sum_out;
            let t = app.btcchain.TX.fromJSON(app, tx);
            let size = t.getSize();

            let cost = fee / size;
            if (cost < app.cnf("consensus").minfeeperbyte) {
                app.throwError('Fee is less then min value', 'tx_fee_less_min');
            }

            return true;
        });
        //Verify the scriptPubKey accepts for each input; reject if any are bad'
        chain.TX.VALIDATOR.addRule('spendable', function (validator, context, app_) {
            let tx = this;
            let sum_in = 0;
            let sum_out = 0;

            let ins = tx.getInputs();
            for (let i in ins) {
                let prev = app.btcchain.getOut(ins[i].hash, ins[i].index);
                if (!prev)
                    app.throwError('Tx prev out is not exist', 'tx_prevout_missing');

                let addrhash = app.btcchain.SCRIPT.scriptToAddrHash(prev.scriptPubKey).toString('hex');
                let pubKey = app.btcchain.SCRIPT.sigToArray(ins[i].scriptSig).publicKey;
                let address = app.btcchain.ADDRESS.generateAddressFromPublicKey(pubKey);
                let addrhashmy = app.btcchain.SCRIPT.getPublicKeyHashByAddress(address).toString('hex');
                var res = addrhashmy == addrhash
                if (!res) {
                    app.throwError('Tx scriptSig is not spendable', 'tx_unspendable');
                }

            }

            return true;
        });
        ////Add to transaction pool[7]
        //"Add to wallet if mine"
        //Relay transaction to peers
        //For each orphan transaction that uses this one as one of its inputs, run all these steps (including this one) recursively on that orphan



    }

    function blocks() {

        chain.BLOCK.VALIDATOR.addRule('', function (validator, context, app) {
            let block = this;

            //app.throwError("msg", 'code');
            return true;
        });

    }

}


