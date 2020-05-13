module.exports = (app) => {
    class Indexer extends app.storage.Index {
        constructor() {
            super(app, 'indexes', false);
            this.init();
        }
        updateTop(data) {
            return this.set('top', data)
                .then(() => {
                    let t = this.get('top');
                    this.app.debug("info", "index", "new top: " + t.id + ", height: " + t.height);
                    return Promise.resolve(t);
                });
        }
        getTop() {
            return this.get('top')
        }
        getAllDSAddresses() {
            let keys = [];
            let result = this.find({ 'key': { '$contains': 'ds/address/' } })
            for (let i in result)
                if (result[i]) {
                    if (!result[i].value && !(result[i].value instanceof Array))
                        result[i].value = [];
                    keys.push({ name: result[i].key.replace("ds/address/", ""), records: result[i].value.length });
                }

            return keys;
        }

        /*haveblock = function (hash) {
            var bchain = require('../../../blockchain/index');
            var blockchain = new bchain();
            try {
                var block = blockchain.getBlock(hash);
        
                if (block.hash)
                    return true;
            } catch (e) {
            }
        
            var orphan = require('./orphan');
            if (orphan.have(hash)) {
        
                return true;
            }
        
            var mem = require('./memory');
            return !!(mem.get(hash) && mem.get(hash).hash);
        }*/

    }

    return Indexer;
}