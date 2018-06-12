module.exports = function (blockInfo, doneCallback) {

    let DAPP = require("../../index");
    let config = require('../../../config.json');
    config.tests = ['miner', 'pow', 'chain', 'state'];
    config.pow.algo = 'sha256';

    let app = new DAPP(config);
    app.loadToolset('crypto');
    app.loadToolset('tools');
    app.loadModule('pow');
    app.loadModule('db');
    app.loadModule('miner');
    app.loadModule('state');
    app.loadModule('chain');
    //app.loadModule('wallet');

    let txl = [];
    for (let i in blockInfo.txlist) {
        txl.push(app.chain.TX.fromJSON(app, blockInfo.txlist[i]))
    }

    let start = Date.now();
    app.chain.BLOCK.generate(app, blockInfo.header, txl)
        .then(function (block) {
            let stop = Date.now();
            doneCallback(JSON.stringify({
                block: block.toJSON(),
                stats: {
                    start: start,
                    stop:stop,
                    difficulty: block.bits
                }
            }));
        })

};