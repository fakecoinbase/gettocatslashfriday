const DAPP = require("../index");
let app = new DAPP(require('../config.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.on("ready", () => {
    console.log('ready', app.chain.index.getLatest()['DATA']);

    let keystore1 = app.wallet.getAccount('test/ecdh/1');
    let keystore2 = app.wallet.getAccount('test/ecdh/2');
    
    let X1 = app.crypto.createECDHsecret(keystore1.publicKey, keystore2);
    let X2 = app.crypto.createECDHsecret(keystore2.publicKey, keystore1);
    console.log(X1, X2);

    app.send(keystore2, keystore1.publicKey, new Buffer("test"));   
})

app.on("data", function (tx) {
    //transaction have data for this-instance keystore (one of public key of wallet)
    console.log('recived transaction with linked data', tx.toJSON());
});

app.init();
app.connect([
    "morty.node.orwellscan.org:19840"
])