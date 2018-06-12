const threads = require('threads');
const config = threads.config;
const spawn = threads.spawn;

class Miner {

    constructor(app) {
        this.app = app;
        this.thread = null;
    }
    init() {

        config.set({
            basepath: {
                node: __dirname
            }
        });

        this.app.debug("info", "miner", "init miner")
    }
    cleanup() {
        if (this.thread) {
            this.thread.removeAllListeners();
            this.thread.kill();
            this.thread = null;
        }
    }
    start() {
        this.thread = spawn('./worker.js');
        this.thread
            .on('message', (message) => {
                let data = JSON.parse(message);
                this.app.debug('info', 'miner', 'finded block', data.block.number + "/" + data.block.hash);

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
                this.cleanup();
            })
            .on('error', (error) => {
                this.app.debug('error', 'miner', 'worker errored', error);
            })
            .on('exit', () => {
                this.cleanup();
            });

        this.app.setMiningState('process');
        let block = this.app.chain.BLOCK.createNewBlock(this.app);
        this.app.debug("info", "miner", "start miner", block.header.bits)
        this.app.emit("app.mining.start", { block: block });
        this.thread
            .send(block)
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