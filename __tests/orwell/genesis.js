const DAPP = require("../../index");
const config = require('../../config.json');

let app = new DAPP(config);

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.on("beforeinit", ()=>{
    app.skipModules([
        'validatormanager',
        'ui',
        'dapps',
        'network',
        'networkhandler',
        'rpc'
    ]);
})

app.on('init', () => {

    if (!app.cnf('consensus').genesisMode) {
        console.log("genesis mode must be enabled!")
        process.exit(-1);
    }

    let ks = app.cnf('node');
    console.log('delegates:', app.cnf('consensus').delegates)
    let block = app.orwell.BLOCK.createNewBlock(new Buffer("GENESIS"), { public: ks.publicKey, private: ks.privateKey }, app.cnf('consensus').delegates);
    console.log('completed, put next lines into config of your network:\n');
    console.log('### NEW GENESIS ###\n');
    let d = block.toJSON();
    d.hash = block.getHash();
    console.log(JSON.stringify(d));
    console.log("### NEW GENESIS ###");
    process.exit(0);
    /*app.orwell.addBlockFromNetwork(null, block)
        .then((data) => {

            

        })
        .catch(e=>{
            console.log(e)
        })*/
});

app.noConflict((stage) => {//stage can be beforeload (additional modules is not loaded yet) and beforeinit (additional modules is loaded but not inited)
    if (stage == 'beforeload') {
        app.config.arg[app.config.arg.network].rpc.useServer = false;
    }
});
app.init();
