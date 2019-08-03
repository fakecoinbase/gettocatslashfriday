const Worker = require("tiny-worker");

class Miner {

    constructor(app) {
        this.app = app;
    }
    init() {
        this.app.debug("info", "miner", "init miner")
    }
    cleanup() {
        this.worker.terminate();
    }
    start() {

        this.worker = new Worker(require('./worker'), [], { esm: true });
        this.worker.onmessage = (ev) => {
            let message = ev.data;
            let data = JSON.parse(message);
            data.block.height = this.app.orwell.index.getTop().height + 1;
            this.app.debug('info', 'miner', 'finded block', data.block.height + "/" + data.block.hash);

            /*
            this.app.db.load("mstats.json", "mstats");
            let mstats = this.app.db.get("mstats");
            if (!mstats || this.app.tools.emptyObject(mstats))
                mstats = [];
            mstats.push((data.stats.stop - data.stats.start) / 1000);
            this.app.db.set("mstats", mstats);
            console.log(JSON.stringify(mstats));
            this.app.db.save("mstats", "mstats.json");
            */

            this.app.debug('info', 'worker', 'difficulty: ', data.stats.difficulty, 'elapsed time: ', (data.stats.stop - data.stats.start) / 1000, 'seconds');
            this.app.emit("app.mining.stop", { type: 'finished', data: data.block });
            //this.cleanup();            

            this.worker.terminate();
        };

        this.app.setMiningState('process');
        let block = this.app.orwell.BLOCK.createNewBlock();

        this.app.debug("info", "miner", "start miner", block.bits);
        this.app.emit("app.mining.start", { block: block });

        this.worker.postMessage(block);
    }
    stop() {
        this.app.debug("info", "miner", "stop miner")
        this.app.setMiningState('stoped');
        //recived block with this number or stop work or 
        this.app.emit("app.mining.stop", { type: 'interruption', miner: this });
        this.cleanup();
    }

}

module.exports = Miner