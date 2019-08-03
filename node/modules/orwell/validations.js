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
        chain.TX.VALIDATOR.addRule('invaluecoinbase', function (validator, context, app_) {
            if (!(context.trigger == 'block' && context.index != 0)) {
                let tx = this;

                let ins = tx.getInputs();
                for (let i in ins) {

                    if (ins[i].hash == '0000000000000000000000000000000000000000000000000000000000000000' && ins[i].index == 0xffffffff)
                        app.throwError("Transaction in[" + i + "] is coinbase", 'tx_in_coinbase');
                }

                return true;
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

        //1. Check syntactic correctness 
        chain.BLOCK.VALIDATOR.addRule('syntax', function (validator, context, app_) {
            let block = this;

            let hex = block.toHEX();
            let b = chain.BLOCK.fromHEX(app, hex);

            if (b.getHash('raw').toString('hex') == b.getHash()) {//generated hash from hex == old hash from checking tx - valid
                return true;
            }

            app.throwError("Block syntax is invalid", 'block_syntax_invalid');
        });
        //2. Reject if duplicate of block we have in any of the three categories
        chain.BLOCK.VALIDATOR.addRule('duplicate', function (validator, context, app_) {
            let block = this;

            if (context.trigger == 'relay') {
                try {
                    let b = chain.getBlock(block.getHash());
                    if (b.getHash() == block.getHash())
                        app.throwError("Block already exist", 'block_duplicate');
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
                app.throwError("Block txlist empty", 'block_txlist_empty');

            return true;
        });
        //4. Block hash must satisfy claimed nBits proof of work
        chain.BLOCK.VALIDATOR.addRule('hashvalid', function (validator, context, app_) {
            let block = this;

            if (!app.pow.checkHash(block.getHash(), block.bits)) {
                app.throwError("Block hash invalid", 'block_hash_invalid');
            }

            return true;
        });
        //5. Block timestamp must not be more than two hours in the future
        chain.BLOCK.VALIDATOR.addRule('blocktimestamp', function (validator, context, app_) {
            let block = this;

            if (block.time >= (Date.now() / 1000 + 2 * 60 * 60)) {
                app.throwError("Block time invalid or system time is wrong", 'block_time_invalid');
            }

            return true;
        });
        //6. First transaction must be coinbase (i.e. only 1 input, with hash=0, n=-1), the rest must not be
        chain.BLOCK.VALIDATOR.addRule('block_coinbase', function (validator, context, app_) {
            let block = this;

            let ctx = block.vtx[0].toJSON();
            if (!ctx.coinbase)
                app.throwError("Block coinbase transaction missing", 'block_coinbase_invalid');

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
                    app.throwError("Tx #" + i + " in block is invalid", 'block_tx_invalid');
                }

            }

            return res;
        });

        //16.2 Reject if coinbase value > sum of block creation fee and transaction fees
        //8. For the coinbase (first) transaction, scriptSig length must be 2-100
        chain.BLOCK.VALIDATOR.addRule('block_coinbase_sig', function (validator, context, app_) {
            let block = this;

            let res = true;
            let coinbase = block.vtx[0];
            if (coinbase.in[0].scriptSig.length > 200)
                app.throwError("Coinbase tx.in.scriptsig is overlength", 'block_coinbase_invalid');

            let fullfee = 0, amount = 0;
            for (let i in block.vtx) {

                let tx = block.vtx[i];
                let sum_in = 0;
                let sum_out = 0;

                let ins = tx.getInputs();
                for (let k in ins) {
                    let prev = app.btcchain.getOut(ins[k].hash, ins[k].index);
                    if (!prev)
                        app.throwError('Tx prev out is not exist', 'tx_prevout_missing');

                    sum_in += prev.amount;
                }

                let outs = tx.getOutputs();
                for (let k in outs) {
                    sum_out += outs[k].amount;
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

                fullfee += fee;

            }

            for (let i in block.vtx[0].out) {
                amount += block.vtx[0].out[i].amount;
            }

            if (amount < app.pow.getBlockValue(fullfee, context.height)) {
                app.throwError("Coinbase amount is less then minimum blockValue for height" + context.height, 'block_coinbase_amount_invalid');
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

            if (block.hash == chain.GENESIS.header.hash && block.hashPrevBlock == '0000000000000000000000000000000000000000000000000000000000000000')
                return true;

            try {
                prev = chain.getBlock(block.hashPrevBlock);
            } catch (e) {

            }

            if (prev && prev.hash) {
                let childs = chain.getChilds(hashPrevBlock);
                if (block.hash && (childs.length == 0 || (childs.length == 1 && childs[0].hash == validator.block.hash)))
                    return true;

                //orphan
                chain.orphan.add(block.toJSON());
                //if (newAdding && (childs.length == 0 || (childs.length == 1 && childs[0].hash == validator.block.hash)))
                app.emit("chain.block.seek", { hash: block.hashPrevBlock });

                if (childs.length != 0 && childs[0].hash != block.hash) {
                    chain.orphan.tryLongest(block.hash);
                }

                return false;
            } else {
                app.throwError("Prev block is not exist in any pool", 'block_prev_missing');
            }

        });
        //12. Check that nBits value matches the difficulty rules
        chain.BLOCK.VALIDATOR.addRule('bitsvalid', function (validator, context, app_) {
            let block = this;

            if (chain.getDiffForHeight(block.height || context.height) != block.bits) {
                app.throwError("Block bits invalid", 'block_bits_invalid');
            }

            return true;
        });
        //13. Reject if timestamp is the median time of the last 11 blocks or before
        chain.BLOCK.VALIDATOR.addRule('mediantimevalid', function (validator, context, app_) {
            let block = this;

            if (block.time > chain.getTimeForHeight(block.height || context.height)) {
                app.throwError("Block bits invalid", 'block_bits_invalid');
            }

            return true;
        });
        //14. For certain old blocks (i.e. on initial block download) check that hash matches known values (checkpoints)
        chain.BLOCK.VALIDATOR.addRule('checkpoint', function (validator, context, app_) {
            let block = this;

            if (chain.checkpoint[context.height] != block.hash) {
                app.throwError("Block is not equal for checkpoint on height: " + context.height, 'checkpoint_invalid');
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


