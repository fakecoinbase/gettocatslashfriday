const DAPP = require("../../index");

let app = new DAPP(require('../../config.orwell.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.on("app.mining.stop", (event) => {
    if (event.type != 'finished')
        return;

    let block = app.orwell.BLOCK.fromJSON(event.data);
    app.orwell.addBlockFromNetwork(null, block)
        .then((data) => {
            console.log('block added ', data.hash, app.orwell.index.getTop());
            data.send();
            setTimeout(() => {
                app.orwellminer.start(app.wallet.getAccount('miner'));
            }, 2000);

        });
})

app.on('init', () => {
    let keystore = app.wallet.getAccount('miner');
    console.log('inited', keystore);
    if (!keystore.privateKey)
        throw new Error('Keystore miner is not found');

    app.orwellminer.start(app.wallet.getAccount('miner'));
});

app.noConflict((stage) => {//stage can be beforeload (additional modules is not loaded yet) and beforeinit (additional modules is loaded but not inited)
    if (stage == 'beforeload') {
        app.config.arg[app.config.arg.network].rpc.useServer = false;
    }
});
app.init();