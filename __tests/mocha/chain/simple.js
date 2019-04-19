describe('Blockpool check', function () {

    const assert = require('assert');
    const DAPP = require("../../../index");

    let app = new DAPP(require('../../../config.btc-chain.json'));

    process.on('uncaughtException', function (err) {
        console.log('UNCAUGHT EXCEPTION:', err);
    });

    app.on("app.debug", function (data) {
        console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
    });

    app.on('init', () => {
        console.log('inited');
        describe('Simple blockpool', function () {
            
            it('only genesis block1', function () {
                //console.log(app.btcchain.getKnownRange())
            });

        });

    });


    app.init()
});
