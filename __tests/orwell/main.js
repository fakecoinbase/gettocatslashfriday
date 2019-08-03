const DAPP = require("../../index");

let app = new DAPP(require('../../config.orwell.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.on('init', () => {
    console.log('inited');
    //console.log(app.btcchain.getKnownRange())

});

app.init();