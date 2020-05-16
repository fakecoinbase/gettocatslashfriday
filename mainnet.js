const DAPP = require('./index');
const fs = require('fs');

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

let app = DAPP.create('./config.json', 'main');

app.on("app.debug", function (data) {
    if (app.logIsEnabled(data.module, data.level))
        console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.init();
