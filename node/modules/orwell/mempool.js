module.exports = (app) => {
    class MemPool extends app.storage.Index {
        constructor() {
            super(app, 'mempool');
            this.init();
        }
        getPriorityList() {
            let randId = app.db.get('active-transaction');
            let hashes = [];
            if (randId && typeof randId == 'string')
                hashes = app.db.get('active-transaction-list-hashes' + randId);
            let result = this.find({ 'key': { '$contains': 'fee/' } }, ["value", true]);

            let arr = [];
            for (let i in result) {
                let tx = this.get(result[i].key.replace("fee/", ""));
                if (hashes.indexOf(tx.hash) == -1)
                    if (tx)
                        arr.push(tx);
            }

            return arr;
        }
        getList() {
            let arr = this.get('mempooltxlist');
            if (!arr || !(arr instanceof Array))
                arr = [];

            return arr;
        }
        setList(arr) {
            return this.set('mempooltxlist', arr || []);
            //return arr || [];
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
                    return out.address;
                })(tx.in[i])

                tx.in[i].prevAddress = prevAddress;
            }

            let t = this.app.orwell.TX.fromJSON(tx);

            if (t.isCoinbase()) {
                tx.errors = ['iscoinbase'];
                cb(tx, t, false);
                return false;
            }

            if (this.get(t.getHash()).hash) {
                tx.errors = ['alreadyexist'];
                cb(tx, t, false)
                return;
            }

            if (t.isValid()) {
                let promise = Promise.resolve();
                let testunspent = 0;
                for (let inp in tx.in) {
                    let test = this.get("out/" + tx.in[inp].hash + ":" + tx.in[inp].index);
                    if (test && typeof test == 'string') {
                        try {
                            let t = this.getTx(test);
                            if (t && t.out) {
                                testunspent++;
                                console.log("unspent tx error:", "already have used utxo in mempool: ", tx.in[inp].hash + ":" + tx.in[inp].index + ", for tx " + test);
                            } else {
                                this.removeTx(test);
                            }
                        } catch (e) {

                        }
                    }
                }

                if (testunspent > 0) {
                    tx.errors = ['doublespent'];
                    cb(tx, t, false)
                    return;
                }

                if (tx.ds) {
                    promise = promise.then(() => { return this.addDSIndex(tx.hash, tx.out[0]) })
                }

                for (let o in tx.out) {
                    let out = tx.out[o];
                    promise = promise.then(() => { this.addOutIndex('input', tx.hash, out.address, out.amount, fromNet, o); });
                }

                for (let inp in tx.in) {
                    let inpt = tx.in[inp];
                    let prevout;
                    try {
                        promise = promise.then(() => {
                            return this.set("out/" + inpt.hash + ":" + inpt.index, tx.hash);
                        })
                            .then(() => {
                                prevout = this.app.orwell.consensus.dataManager.getOut(inpt.hash, inpt.index);
                                return this.addOutIndex('output', tx.hash, prevout.address, prevout.amount, fromNet);
                            })

                    } catch (e) {
                        //search in mempool
                        console.log("input error: ", inpt.hash + ":" + inpt.index, inpt)
                        console.log(e)
                        cb(tx, t, false)
                        return;
                    }
                }

                promise
                    .then(() => {

                        //create TX object from json, check tx validate, add
                        list.push(t.getHash());
                        return Promise.all([
                            this.setList(list),
                            this.set(t.getHash(), t.toJSON('hash')),
                            this.set("time/" + t.getHash(), new Date().getTime() / 1000),
                            this.set("fee/" + t.getHash(), t.getFee()),
                        ]);

                    })
                    .then(() => {
                        cb(tx, t, true);
                    })
            } else {
                tx.errors = t.validation_errors;
                cb(tx, t, false)
            }
        }
        addOutIndex(type, tx, addr, amount, events, index) {
            let promise = Promise.resolve();
            this.app.debug('info', 'mempool', "add unconfirmed index " + addr, tx, amount)

            let addreses = this.get("addresstx/" + tx);

            if (!addreses || !(addreses instanceof Array))
                addreses = [];

            addreses.push(addr);
            return promise
                .then(() => {
                    return this.set("addresstx/" + tx, addreses);
                })
                .then(() => {

                    let addrind = this.get("address/" + addr);
                    if (!addrind || !(addrind instanceof Array))
                        addrind = [];

                    let obj = {
                        type: type, //input||output
                        tx: tx,
                        index: index,
                        amount: amount
                    };
                    addrind.push(obj);

                    if (events) {
                        obj.address = addr;
                        this.app.emit("chain.event.unconfirmed.address", obj)
                    }

                    return this.set("address/" + addr, addrind)
                });
        }
        removeTx(txHash, removeForce) {
            //remove tx from pool
            //remove address index

            //removeForce//if removeForce == true - remove from mempool not added to block - checkand unlock fix

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
                promise = promise.then(() => {
                    this.remove("address/" + addreses[i]); return Promise.resolve();
                })
            }

            ///outs
            let tx = this.get(txHash);
            for (let i in tx.in) {
                promise = promise.then(() => { this.remove("address/" + tx.in[i].hash + ":" + tx.in[i].index); return Promise.resolve(); });
                promise = promise.then(() => {
                    return this.remove("out/" + tx.in[i].hash + ":" + tx.in[i].index);
                })
            }
            //ds/address

            for (let i in tx.out) {
                let out = tx.out[i];
                let addrhash = this.app.orwell.ADDRESS.getPublicKeyHashByAddress(out.address).toString('hex');

                promise = promise.then(() => { this.remove("ds/address/" + addrhash); return Promise.resolve(); });
            }


            return Promise.all([
                promise,
                this.remove("addresstx/" + txHash),
                this.remove("fee/" + txHash),
                this.remove("time/" + txHash),
                this.remove(txHash)
            ])
                .then(() => {
                    if (removeForce)
                        for (let i in addreses) {
                            this.app.orwell.utxo.checkAndUnlock(addreses[i]);
                        }

                    return Promise.resolve();
                });
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
            out.address = out.address;
            out.addrHash = this.app.orwell.ADDRESS.getPublicKeyHashByAddress(out.address).toString('hex');

            this.app.debug('info', 'mempool', "add unconfirmed ds index " + out.addrHash, txid);
            let addrind = this.get("ds/address/" + out.addrHash);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            addrind.push(txid);
            this.set("ds/address/" + out.addrHash, addrind)
            return addrind
        }
        getTx(hash) {
            return this.get(hash);
        }
        checkAndUnlock(address) {
            let addrind = this.get("address/" + address);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].spent || addrind[i].spentHash || addrind[i].locked) {
                    if (!this.getTx(addrind[i].spentHash)) {
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
        }
    }

    return MemPool;
}