const DAPP = require("../../index");

let app = new DAPP(require('../../config.orwell.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.init()


app.on('init', () => {
    console.log('inited');
    console.log('node is not running. Please, run app (genesis.js) with consensus.genesisMode = 1, and start mining pool and miner');
    //process.exit(0);

    //create new first block
    let cb = app.orwell.TX.createCoinbase([app.cnf('node').privateKey]);

    let block = new app.orwell.BLOCK({
        version: app.cnf("consensus").version,
        hashPrevBlock: '0000000000000000000000000000000000000000000000000000000000000000',
        time: parseInt(Date.now() / 1000),
        bits: app.orwell.getActualDiff(),
        nonce: 0
    }, [cb]);

    app.pow.setOnIteration((nonce) => {
        if (nonce % 100000 == 0)
            console.log('nonce >:', nonce);
        block.nonce = nonce;

        return {
            buffer: (block.hashBytes()),
            difficulty: block.bits
        };
    })

    console.log("start search:");
    app.pow.startDig((nonce) => {
        block.nonce = nonce;
        //block.hash = block.getHash();
        console.log('completed, put next lines into config of your network:\n');
        console.log('### NEW GENESIS ###\n');
        let b = block.toJSON();
        console.log(JSON.stringify(b));
        console.log("### NEW GENESIS ###");
        process.exit(0);
    });


})