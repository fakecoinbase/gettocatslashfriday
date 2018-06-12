class Index {

    constructor(app) {
        this.app = app;
    }
    cleanup() {
        this.tempindex = { DATA: {} };
    }
    create() {
        this.cleanup();
        let list = this.app.db.get("blocks");
        for (let k in list) {
            this.index(list[k]);
        }

        //save index in-memory
    }
    update(block) {
        this.index(block);
    }
    index(block) {

        this.tempindex["block/" + block.hash] = block;
        this.tempindex["block/number/" + block.number] = block.hash;
        this.tempindex["block/prev/" + block.hash] = block.prevblock;
        this.tempindex["number/" + block.hash] = block.number;
        let creators = this.tempindex['creators'];
        if (!creators)
            creators = [];
        creators.unshift(block.tx[0].key);
        this.tempindex['creators'] = creators;

        let times = this.tempindex['times'];
        if (!times)
            times = [];
        times.unshift(block.timestamp);
        this.tempindex['times'] = times;

        let difficulty = this.tempindex['difficulty'];
        if (!difficulty)
            difficulty = [];
        difficulty.unshift(block.bits);
        this.tempindex['difficulty'] = difficulty;

        for (let i in block.tx) {
            this.indextx(block, block.tx[i], i);
        }

    }
    indextx(block, tx, i) {

        this.tempindex["tx/" + tx.hash] = tx;
        this.tempindex["tx/block/" + tx.hash] = block.hash;
        this.tempindex["tx/block/number/" + tx.hash] = block.number;
        this.tempindex["tx/number/" + tx.hash] = i;

        if (tx.timestamp == 0)
            return;

        let keydata = this.tempindex["DATA"][tx.key];
        if ((!(keydata instanceof Array) && !keydata) || !keydata.length)
            keydata = [];

        keydata.push(tx.data);
        this.tempindex["DATA"][tx.key] = keydata;
        let timeouts = this.tempindex['timeouts'];
        if (!timeouts)
            timeouts = {};
        timeouts[parseInt(tx.timestamp) + parseInt(this.app.cnf('consensus')['data.timeout'])] = tx.hash;
        this.tempindex['timeouts'] = timeouts;
        this.removeTimedout();
    }
    removeTimedout() {
        if (this.app.cnf('consensus')['data.timeout'] > 0) {
            let timeouts = this.tempindex['timeouts'];
            if (!timeouts)
                timeouts = [];

            let now = Date.now() / 1000;
            for (let k in timeouts) {
                if (k < now) {
                    //remove tx.hash == timeouts[k] index
                    let hash = timeouts[k];
                    let _tx = this.tempindex["tx/" + hash];

                    for (let i in this.tempindex['DATA'][_tx.key]) {
                        let _txdata = this.tempindex['DATA'][_tx.key][i];
                        if (_txdata === _tx.data) {
                            delete this.tempindex['DATA'][_tx.key].splice(i, 1);
                        }
                    }

                    delete this.tempindex["tx/" + hash];
                    delete this.tempindex["tx/block/" + hash];
                    delete this.tempindex["tx/block/number/" + hash];
                    delete this.tempindex["tx/number/" + hash];
                    delete timeouts[k];
                }
            }

            this.tempindex['timeouts'] = timeouts;
        }
    }
    getLatest() {
        return this.tempindex;
    }

}

module.exports = Index