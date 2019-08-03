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
            setTimeout(() => {
                app.orwellminer.start();
            }, 2000);

        });
})

app.on('init', () => {
    console.log('inited');
    app.orwellminer.start();
});

app.init();