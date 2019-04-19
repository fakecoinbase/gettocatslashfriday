module.exports = (app) => {
    class UTXO extends app.storage.Index {
        constructor() {
            super(app, 'utxo');
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
        addTx(tx, cb) {
            if (app.cnf('debug').utxo)
                app.debug("utxo", "info", "UTXO tx: " + tx.hash)

            let outs = tx.out;
            for (let o in outs) {
                var out = outs[o];
                this.addOutIndex(tx.hash, o, out.address, out.amount);
            }

            for (let inp in tx.in) {
                let inpt = tx.in[inp];

                if (inpt.hash == '0000000000000000000000000000000000000000000000000000000000000000')//coinbase
                    continue;

                let prevout;
                try {
                    prevout = app.btcchain.getOut(inpt.hash, inpt.index);
                    this.removeOutIndex(tx.hash, prevout.addr, inpt.hash, inpt.index);
                } catch (e) {
                    //search in mempool
                }
            }

            if (cb instanceof Function)
                cb(tx);
        }
        addOutIndex(tx, index, addr, amount) {
            if (app.cnf('debug').utxo)
                app.debug("utxo", "info", "add UTXO index " + addr, tx + ":" + index, amount)

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
                    spent: false
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
        removeOutIndex(txhash, addr, tx, index) {
            if (app.cnf('debug').utxo)
                app.debug("utxo", "info", "update spent UTXO index " + txhash + " " + addr, tx + ":" + index)

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
        getUTXOList(addr, limit, offset) {
            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            let spent = 0, unspent = 0, spent_in = 0, unspent_in = 0;

            for (let i in addrind) {
                if (addrind[i].spent && addrind[i].spentHash) {
                    spent += addrind[i].amount;
                    spent_in++;
                } else {
                    unspent += addrind[i].amount;
                    unspent_in++;
                }
            }

            let items = addrind.slice(offset, offset + limit);
            return {
                stats: {
                    spent_inputs: spent_in,
                    spent_amount: spent,
                    unspent_inputs: unspent_in,
                    unspent_amount: unspent
                },
                limit: limit,
                offset: offset,
                count: addrind.length,
                items: items.length,
                list: items
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


    }

    return UTXO;
}