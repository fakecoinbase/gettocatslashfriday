const DAPP = require("../index");
let app = new DAPP(require('../config.btc-chain.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});


app.on("ready", () => {
    console.log('ready')
})

app.on("data", function (tx) {
    //transaction have data for this-instance keystore (one of public key of wallet)
});

app.init()
    .then(() => {
        /*app.connect([
            "morty.node.orwellscan.org:19840"
        ])*/
    })