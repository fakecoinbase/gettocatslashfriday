module.exports = (app) => {
    class UTXO extends app.storage.Index {
        constructor() {
            super(app, 'utxo', false);
            this.init();
        }
        getList() {
            let arr = this.get('utxolist');
            if (!arr || !(arr instanceof Array))
                arr = [];
            return arr;
        }
        setList(arr) {
            this.set('utxolist', arr || []);
            return arr || [];
        }
        getCount() {
            return this.getList().length;
        }
        addTx(tx, options) {
            app.debug("info", "utxo", "UTXO tx: " + tx.hash)

            app.orwell.utxh.addInputs(tx, options);
            let outs = tx.out;
            for (let o in outs) {
                var out = outs[o];
                this.addOutIndex(tx.hash, o, out.address, out.amount, options);
            }

            for (let inp in tx.in) {
                let inpt = tx.in[inp];

                if (inpt.hash == '0000000000000000000000000000000000000000000000000000000000000000')//coinbase
                    continue;

                let prevout;
                try {
                    prevout = app.orwell.getOut(inpt.hash, inpt.index);
                    app.orwell.utxh.spentInput(prevout.address, inpt.hash, inpt.index, tx.hash, options);
                    this.removeOutIndex(tx.hash, prevout.address, inpt.hash, inpt.index);
                } catch (e) {
                    console.log('error', e)
                    //search in mempool
                }
            }

        }
        removeTx(tx, options) {
            app.orwell.utxh.removeInputs(tx, options);
            let outs = tx.out;
            for (let o in outs) {
                var out = outs[o];
                this.removeIndex(tx.hash, o, out.address, out.amount, options);
            }

            for (let inp in tx.in) {
                let inpt = tx.in[inp];

                if (inpt.hash == '0000000000000000000000000000000000000000000000000000000000000000')//coinbase
                    continue;

                let prevout;
                try {
                    prevout = app.orwell.getOut(inpt.hash, inpt.index);
                    app.orwell.utxh.removeSpentInput(prevout.address, inpt.hash, inpt.index, tx.hash, options);
                    this.removeSpentIndex(tx.hash, prevout.address, inpt.hash, inpt.index);
                } catch (e) {
                    console.log('error', e)
                    //search in mempool
                }
            }
        }
        addOutIndex(tx, index, addr, amount, options) {
            app.debug("info", "utxo", "add UTXO index " + addr, tx + ":" + index, amount)

            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            let finded = 0;
            for (let i in addrind) {
                if (addrind[i].tx == tx && addrind[i].index == index) {
                    finded = 1;
                    break;
                }
            }

            if (!finded) {
                let obj = {
                    tx: tx,
                    index: index,
                    amount: amount,
                    spent: false,
                    height: options.height
                };

                let o = obj;
                o.address = addr;
                app.emit("utxo.unspent", o)
                addrind.push(obj);

                let list = this.getList();
                list.push(tx + ":" + index);
                this.setList(list);

                this.set("address/" + addr, addrind)
            }

            return addrind
        }
        removeIndex(tx, index, addr, amount, options) {
            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            let finded = 0, indx = -1;
            for (let i in addrind) {
                if (addrind[i].tx == tx && addrind[i].index == index) {
                    finded = 1, indx = i;
                    break;
                }
            }

            if (finded) {
                addrind.splice(indx, 1)

                this.set("address/" + addr, addrind)
                let list = this.getList();
                let indx2 = list.indexOf(tx + ":" + index);
                if (indx2 != -1)
                    list.splice(indx2, 1);
                this.setList(list);
            }

        }
        removeOutIndex(txhash, addr, tx, index) {
            app.debug("info", "utxo", "update spent UTXO index " + txhash + " " + addr, tx + ":" + index)

            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].tx == tx && addrind[i].index == index) {
                    let o = addrind[i];
                    o.address = addr;
                    o.spent = true;
                    o.spentHash = txhash;
                    app.emit("utxo.spent", o)
                    //addrind[i].splice(i, 1);
                    addrind[i] = o;
                    let list = this.getList();
                    list.splice(list.indexOf(tx + ":" + index), 1);
                    this.setList(list);
                    break;
                }
            }

            this.set("address/" + addr, addrind)
            return addrind

        }
        removeSpentIndex(txhash, addr, tx, index) {
            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].tx == tx && addrind[i].index == index) {
                    let o = addrind[i];
                    o.address = addr;
                    o.spent = false;
                    o.spentHash = '';
                    
                    addrind[i] = o;
                    let list = this.getList();
                    list.push(tx + ":" + index);
                    this.setList(list);
                    break;
                }
            }

            this.set("address/" + addr, addrind)
            return addrind
        }
        have(addr, hash, index, txid) {
            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].tx == hash && addrind[i].index == index) {
                    let o = addrind[i];
                    if (!o.spent || o.spentHash == txid)
                        return true;
                }
            }

            return false;
        }
        getAmount(addr, hash, index) {
            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].tx == hash && addrind[i].index == index) {
                    let o = addrind[i];
                    return o.amount
                }
            }

            return false;
        }
        getUTXOInfo(addr, hash, index) {
            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].tx == hash && addrind[i].index == index) {
                    return addrind[i]
                }
            }

            return false;
        }
        getUTXOList(addr, limit, offset) {
            let a = this.get("address/" + addr);
            let addrind = [...a];

            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            addrind.reverse();

            let spent = new app.tools.BN(0), unspent = new app.tools.BN(0), spent_in = 0, unspent_in = 0;

            for (let i in addrind) {
                if (addrind[i].spent && addrind[i].spentHash) {
                    spent.iadd(new app.tools.BN(addrind[i].amount));
                    spent_in++;
                } else {
                    unspent.iadd(new app.tools.BN(addrind[i].amount));
                    unspent_in++;
                }
            }

            let items = addrind.slice(offset, offset + limit);
            return {
                stats: {
                    spent_inputs: spent_in,
                    spent_amount: spent.toString(10),
                    unspent_inputs: unspent_in,
                    unspent_amount: unspent.toString(10)
                },
                limit: limit,
                offset: offset,
                count: addrind.length,
                items: items.length,
                list: items
            }
        }
        getUTXOHistory(addr, limit, offset) {
            let addrind;
            let a = this.get("address/" + addr);
            addrind = [...a];

            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            addrind.reverse();

            let spent = new app.tools.BN(0), unspent = new app.tools.BN(0), spent_in = 0, unspent_in = 0;

            for (let i in addrind) {
                if (addrind[i].spent && addrind[i].spentHash) {
                    spent.iadd(new app.tools.BN(addrind[i].amount));
                    spent_in++;
                } else {
                    unspent.iadd(new app.tools.BN(addrind[i].amount));
                    unspent_in++;
                }
            }

            let items = addrind.slice(offset, offset + limit);

            let items2 = [];
            for (let i in items) {

                let tx = app.orwell.getTx(items[i].tx);

                if (items[i].spent && items[i].spentHash && !tx.isCoinbase()) {
                    let addressess = [];

                    let tx = app.orwell.getTx(items[i].spentHash);
                    let outs = tx.getOutputs();
                    if (outs.length == 2) {//change
                        addressess = [outs.address];
                    } else {
                        for (let o in outs) {
                            addressess.push(outs[o]);
                        }
                    }

                    items2.push({
                        type: 'out',
                        tx: items[i].spentHash,
                        from: [addr],
                        to: addressess,
                        amount: items[i].amount,
                        height: items[i].height,
                    })
                } else {
                    let tx = app.orwell.getTx(items[i].tx);
                    let ins = tx.toJSON().s;

                    let addressess = [];

                    if (!tx.isCoinbase())
                        for (let n in ins) {
                            let addr = app.orwell.ADDRESS.generateAddressFromPublicKey(ins[n][1]);
                            addressess.push(addr);
                        }

                    items2.push({
                        type: 'in',
                        tx: items[i].spentHash ? items[i].spentHash : items[i].tx,
                        from: addressess,
                        to: [addr],
                        amount: items[i].amount,
                        height: items[i].height,
                    })
                }


            }

            return {
                stats: {
                    spent_inputs: spent_in,
                    spent_amount: spent.toString(10),
                    unspent_inputs: unspent_in,
                    unspent_amount: unspent.toString(10)
                },
                limit: limit,
                offset: offset,
                count: addrind.length,
                items: items2.length,
                list: items2
            }
        }
        startValidate(hash) {
            //create dump of all used unspent inputs in block while validate, when validate is stop - do utxo.stopValidate(hash), and check count of usage (must be 1 for all), if not = double spending
            this.set("block/" + hash, {});
            this.validateblock = hash;
        }
        inBlockValidateStage() {
            return this.validateblock
        }
        addUsage(txhash, unspentinputhash, unspentinputindex) {
            let dump = this.get("block/" + this.validateblock);
            if (!dump)
                dump = {};

            let arr = dump[unspentinputhash + ":" + unspentinputindex];
            if (!arr || !(arr instanceof Array))
                arr = [];

            arr.push(txhash);
            dump[unspentinputhash + ":" + unspentinputindex] = arr;
            this.set("block/" + this.validateblock, dump);
        }

        stopValidate(hash) {
            let dump = this.get("block/" + hash);
            this.validateblock = null;
            this.remove("block/" + hash);
            return dump;
        }

        checkAndUnlock(address) {
            let addrind = this.get("address/" + address);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].spent || addrind[i].spentHash || addrind[i].locked) {
                    if (!this.app.orwell.mempool.getTx(addrind[i].spentHash)) {
                        try {
                            this.app.orwell.getTx(addrind[i].spentHash)
                        } catch (e) {
                            delete addrind[i].spentHash;
                            delete addrind[i].locked;
                            delete addrind[i].spent;
                        }
                    }
                }
            }

            this.set("address/" + address, addrind);
            this.app.orwell.mempool.checkAndUnlock(address);
            return addrind;
        }

    }

    return UTXO;
}