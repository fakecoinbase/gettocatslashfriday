module.exports = (app) => {
    class MemPool extends app.storage.Index {
        constructor() {
            super(app, 'mempool');
            this.init();
        }
        getPriorityList() {
            let result = this.find({ 'key': { '$contains': 'fee/' } }, ["value", true]);

            let arr = [];
            for (let i in result) {
                let tx = this.get(result[i].key.replace("fee/", ""));
                if (tx)
                    arr.push(tx);
            }

            return arr;
        }
        getList() {
            let arr = this.get('mempooltxlist');
            if (!arr || !(arr instanceof Array))
                arr = [];
                console.log(arr);
            return arr;
        }
        setList(arr) {
            this.set('mempooltxlist', arr || []);
            return arr || [];
        }
        getOrderedList() {
            return this.getPriorityList();
        }
        getCount() {
            return this.getList().length;
        }
        getSize() {
            let arr = this.getList();
            let f = 0;
            for (let i in arr) {
                f += arr[i].size;
            }
            return f
        }
        getFee() {
            let arr = this.getList();
            let f = 0;
            for (let i in arr) {
                f += arr[i].fee;
            }
            return f
        }
        addTx(tx, cb, fromNet) {
            let list = this.getList();
            if (!list || !(list instanceof Array))
                list = [];

            for (let i in tx.in) {
                let prevAddress = ((tx_in) => {
                    let out = this.app.orwell.consensus.dataManager.getOut(tx_in.hash, tx_in.index);
                    return this.app.orwell.SCRIPT.scriptToAddr(out.scriptPubKey || out.script);
                })(tx.in[i])

                tx.in[i].prevAddress = prevAddress;

            }

            let t = this.app.orwell.TX.fromJSON(tx);
            t.fromHex();

            if (t.coinbase) {
                tx.errors = ['iscoinbase'];
                cb(tx, t, false);
                return false;
            }

            if (this.get(tx.hash).hash) {
                tx.errors = ['alreadyexist'];
                cb(tx, t, false)
                return;
            }

            if (t.isValid()) {
                let testunspent = 0;
                for (let inp in tx.in) {
                    let test = this.get("out/" + tx.in[inp].hash + ":" + tx.in[inp].index);
                    if (test && typeof test == 'string') {
                        testunspent++;
                        console.log("unspent tx error:", "already have used utxo in mempool: ", tx.in[inp].hash + ":" + tx.in[inp].index + ", for tx " + test);
                    }
                }

                if (testunspent > 0) {
                    tx.errors = ['doublespent'];
                    cb(tx, t, false)
                    return;
                }

                if (tx.datascript) {
                    this.addDSIndex(tx.hash, tx.out[0])
                }

                for (let o in tx.out) {
                    let out = tx.out[o];
                    this.addOutIndex('input', tx.hash, this.app.orwell.SCRIPT.scriptToAddr(out.scriptPubKey || out.script), out.amount);
                }

                for (let inp in tx.in) {
                    let inpt = tx.in[inp];
                    let prevout;
                    try {
                        this.set("out/" + inpt.hash + ":" + inpt.index, tx.hash);
                        prevout = this.app.orwell.consensus.dataManager.getOut(inpt.hash, inpt.index);
                        this.addOutIndex('output', tx.hash, this.app.orwell.SCRIPT.scriptToAddr(prevout.scriptPubKey || prevout.script), prevout.amount, fromNet);
                    } catch (e) {
                        //search in mempool
                        console.log("input error: ", inpt.hash + ":" + inpt.index, inpt)
                        console.log(e)
                        cb(tx, t, false)
                        return;
                    }
                }

                //create TX object from json, check tx validate, add
                list.push(tx.hash);
                this.setList(list);
                this.set(tx.hash, tx);
                this.set("time/" + tx.hash, new Date().getTime() / 1000);
                this.set("fee/" + tx.hash, t.getFee());
                cb(tx, t, true);
            } else {
                tx.errors = t.validation_errors;
                cb(tx, t, false)
            }
        }
        addOutIndex(type, tx, addr, amount, events) {
            if (this.app.cnf('debug').indexing)
                this.app.debug('info', 'mempool', "add unconfirmed index " + addr, tx, amount)

            let addreses = this.get("addresstx/" + tx);

            if (!addreses || !(addreses instanceof Array))
                addreses = [];

            addreses.push(addr);
            this.set("addresstx/" + tx, addreses);

            let addrind = this.get("address/" + addr);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            let obj = {
                type: type, //input||output
                tx: tx,
                amount: amount
            };
            addrind.push(obj);

            if (events) {
                obj.address = addr;
                this.app.emit("chain.event.unconfirmed.address", obj)
            }

            this.set("address/" + addr, addrind)
            return addrind
        }
        removeTx(txHash) {
            //remove tx from pool
            //remove address index

            console.log('removeTx:', txHash);
            let promise = Promise.resolve();

            let list = this.getList();
            if (!list || !(list instanceof Array))
                list = [];
            list.splice(list.indexOf(txHash), 1);
            this.setList(list);

            //remove address index
            let addreses = this.get("addresstx/" + txHash);
            if (!addreses || !(addreses instanceof Array))
                addreses = [];

            for (let i in addreses) {
                promise = promise.then(() => { this.remove("address/" + addreses[i]); return Promise.resolve(); });
            }

            ///outs
            let tx = this.get(txHash);
            for (let i in tx.in) {
                promise = promise.then(() => { this.remove("address/" + tx.in[i].hash + ":" + tx.in[i].index); return Promise.resolve(); });
            }
            //ds/address

            for (let i in tx.out) {
                let out = tx.out[i];
                out.address = this.app.orwell.SCRIPT.scriptToAddr(out.scriptPubKey || out.script);
                out.addrHash = this.app.orwell.SCRIPT.scriptToAddrHash(out.scriptPubKey || out.script).toString('hex');
                promise = promise.then(() => { this.remove("ds/address/" + out.addrHash); return Promise.resolve(); });
            }


            return Promise.all([
                promise,
                this.remove("addresstx/" + txHash),
                this.remove("fee/" + txHash),
                this.remove("time/" + txHash),
                this.remove(txHash)
            ]);
        }
        have(txHash) {
            let list = this.getList();
            if (!list || !(list instanceof Array))
                list = [];

            return list.indexOf(txHash) >= 0;
        }

        getOldest() {
            let result = this.find({ 'key': { '$contains': 'time/' } }, ["value", false]);
            if (result.length)
                return result[0].value;
            return 0;
        }
        addDSIndex(txid, out) {
            out.address = this.app.orwell.SCRIPT.scriptToAddr(out.scriptPubKey || out.script);
            out.addrHash = this.app.orwell.SCRIPT.scriptToAddrHash(out.scriptPubKey || out.script).toString('hex');

            this.app.debug('info', 'mempool', "add unconfirmed ds index " + out.addrHash, txid);
            let addrind = this.get("ds/address/" + out.addrHash);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            addrind.push(txid);
            this.set("ds/address/" + out.addrHash, addrind)
            return addrind
        }

    }

    return MemPool;
}