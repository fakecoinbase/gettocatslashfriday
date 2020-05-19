module.exports = (app) => {
    class UTXH extends app.storage.Entity {
        constructor() {
            super(app, 'utxh', 'index')
            this.init();
        }
        addInputs(tx, options) {
            let promise = Promise.resolve();
            for (let i in tx.out) {
                promise = promise.then(() => {
                    return this.save({
                        hash: tx.hash + ":" + i,
                        tx: tx.hash,
                        index: i,
                        address: tx.out[i].address,
                        amount: tx.out[i].amount,
                        height: options.height,
                        spent: false,
                        spentHash: ''
                    });
                })
            }

            return promise;
        }
        spentInput(address, hash, index, txHash, options) {
            let u = this.coll.chain().find({ address: address, hash: hash + ":" + index }).limit(limit);
            u.spent = true;
            u.spentHash = txHash;
            u.spentHeight = options.height;
            u.save();
            return Promise.resolve()
        }
        removeInputs(tx, options) {
            let promise = Promise.resolve();
            for (let i in tx.out) {
                promise = promise.then(() => {
                    return this.remove(tx.hash + ":" + i);
                })
            }

            return promise;
        }
        removeSpentInput(address, hash, index, txHash, options) {
            let u = this.coll.chain().find({ address: address, hash: hash + ":" + index }).limit(limit);
            u.spent = false;
            u.spentHash = '';
            u.spentHeight = '';
            u.save();
            return Promise.resolve()
        }
    }

    return UTXH;
}