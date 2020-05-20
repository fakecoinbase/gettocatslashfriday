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
            let u = this.coll.chain().find({ address: address, hash: hash + ":" + index }).limit(1);
            u[0].spent = true;
            u[0].spentHash = txHash;
            u[0].spentHeight = options.height;
            u[0].save();
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
            let u = this.coll.chain().find({ address: address, hash: hash + ":" + index }).limit(1);
            u[0].spent = false;
            u[0].spentHash = '';
            u[0].spentHeight = '';
            u[0].save();
            return Promise.resolve()
        }
    }

    return UTXH;
}