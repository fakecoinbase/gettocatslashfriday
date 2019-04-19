const DAPP = require("../../index");

let app = new DAPP(require('../config.btc-chain.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.init()


app.on('init', () => {
    console.log('inited');
    console.log('please, run app (btc-main.js) with consensus.genesisMode = 1, and start mining pool and miner');
    process.exit(0);

    //create new first block
    let cb = app.btcchain.TX.createCoinbase(app, {
        in: [{ scriptSig: "coinbase text" }],
        out: [{ amount: 50e9, address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' }],
        lock_time: 0,
        version: app.cnf("consensus").version
    });

    let block = new app.btcchain.BLOCK(app, {
        version: app.cnf("consensus").version,
        hashPrevBlock: '0000000000000000000000000000000000000000000000000000000000000000',
        time: parseInt(Date.now() / 1000),
        bits: app.btcchain.getActualDiff(),
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
        console.log(JSON.stringify({
            header: {
                hash: b.hash,
                version: b.version,
                bits: b.bits,
                nonce: b.nonce,
                time: b.time,
                hashPrevBlock: b.hashPrevBlock,
                hashMerkleRoot: b.hashMerkleRoot,
            },
            txlist: [block.vtx[0].toHex()]
        }));
        console.log("### NEW GENESIS ###");
    });


})