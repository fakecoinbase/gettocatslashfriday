const DAPP = require('./index');

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

let app = DAPP.create('./config.json', 'test');

//T means we in testnet.
app.on("app.debug", function (data) {
    console.log("T/ [" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.init();
