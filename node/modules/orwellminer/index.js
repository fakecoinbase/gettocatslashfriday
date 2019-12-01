const Worker = require("tiny-worker");
const bitPony = require('bitpony');

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
    start(keystore) {

        this.worker = new Worker(require('./worker'), [], { esm: true });
        this.worker.onmessage = (ev) => {
            let message = ev.data;
            let data = JSON.parse(message);
            data.block.height = this.app.orwell.index.getTop().height + 1;
            this.app.debug('info', 'miner', 'found block', data.block.height + "/" + data.block.hash);

            this.app.debug('info', 'worker', 'difficulty: ', data.stats.difficulty, 'elapsed time: ', (data.stats.stop - data.stats.start) / 1000, 'seconds');
            this.app.emit("app.mining.stop", { type: 'finished', data: data.block });
            //this.cleanup();            

            this.worker.terminate();
        };

        this.app.setMiningState('process');
        let buffer = new Buffer("");

        let signal_bytes = [0x0];//votes todo.
        let w = new bitPony.writer(buffer);
        w.string("nanocat", true);//author name or company name
        w.string("laptop/common-miner", true);//hardware and software name
        w.uint32(parseInt(Date.now() / 1000), true);//unique timestamp of tx
        w.var_int(signal_bytes.length, true);//count of signal bytes (uint8) or 0 of dont have bytes.
        //signal bytes:
        for (let i in signal_bytes) {
            w.uint8(signal_bytes[i], true);
        }

        let block = this.app.orwell.BLOCK.createNewBlock(w.getBuffer().toString('hex'), keystore);
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