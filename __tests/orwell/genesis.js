const DAPP = require("../../index");
const config = require('../../config.orwell.json');

if (!config[config.network].consensus.genesisMode) {
    console.log("genesis mode must be enabled!")
    process.exit(-1);
}

let app = new DAPP(config);

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

            console.log('completed, put next lines into config of your network:\n');
            console.log('### NEW GENESIS ###\n');
            let b = data;
            console.log(JSON.stringify(b));
            console.log("### NEW GENESIS ###");
            process.exit(0);

        });
})

app.on('init', () => {
    console.log('inited');
    let ks = app.wallet.getAccount('node');
    app.orwellminer.start(ks);
});

app.noConflict((stage) => {//stage can be beforeload (additional modules is not loaded yet) and beforeinit (additional modules is loaded but not inited)
    if (stage == 'beforeload') {
        app.config.arg[app.config.arg.network].rpc.useServer = false;
    }
});
app.init();
