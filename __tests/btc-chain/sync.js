const DAPP = require("../../index");

let app = new DAPP(require('../../config.btc-chain.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.on('init', () => {
    //console.log(app.btcchain.getKnownRange())

});

app.on("ready", () => {

    let prevhash = app.btcchain.index.get('top').hash;
    console.log('inited, ' + prevhash);
    /*
    for (let m = 0; m < 1000; m++) {
        
        console.log(m);
        let head = {
            version: 1,
            hashPrevBlock: prevhash,
            time: Date.now() / 1000,
            bits: app.btcchain.getActualDiff(),
            nonce: m,
        };
        let b = new app.btcchain.BLOCK(app, head, [
            app.btcchain.TX.createCoinbase(app, {
                version: 1,
                lock_time: 0,
                in: [
                    {
                        scriptSig: 'test/' + m
                    }
                ],
                out: [
                    {
                        value: 100000,
                        amount: 100000,
                        address: '1HuT3Ky1kVtwnuqbhb8B24cfhjVLrMpTgY',
                    }
                ]
            })
        ]);

        app.btcchain.appendBlock(b, false, (block) => {

        });
        prevhash = b.getHash('hex');
        console.log('hash', prevhash);
    }*/
})

app.init();