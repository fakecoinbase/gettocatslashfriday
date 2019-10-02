const DAPP = require("../../index");

let app = new DAPP(require('../../config.orwell.json'));
app.skipModules(['network', 'rpc']);

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.on('init', () => {

    let k = {};
    console.log('main tree');
    let list = app.orwell.blockpool.loadBlocks();
    let c = list.length - 1;
    for (let i = c; i >= 0; i--) {
        k[list[i].hash] = i;
        console.log(i, list[i].hash);
    }

    console.log('side tree');
    let list2 = app.orwell.sidepool.loadBlocks();
    let c2 = list2.length - 1;
    for (let o = c2; o >= 0; o--) {

        let h = k[list2[o].prev];
        let m = list2[o].prev;
        if (isFinite(h))
            m = h;

        console.log(list2[o].hash + " -> " + m);
    }

});

app.init();