const DAPP = require("../../index");

let app = new DAPP(require('../../config.orwell.json'));

process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION:', err);
});

app.on("app.debug", function (data) {
    if (data.module == 'network' || data.module == 'handler')
        return false;
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

app.on('init', () => {

    console.log('inited', app.getSyncState(), app.getAppState());
});

app.on("ready", () => {

    //let msg = app.network.protocol.createMessage('block', { "hash": "0f82f9182847ae694b61e8de6e21804c03747e6201983d3efd8d35fa9c743801", "version": 1, "prev": "0000000000000000000000000000000000000000000000000000000000000000", "merkle": "a0b2f8c9b6037982d5b8a83db22c30e187fcb446127d0ad54640c4b8d67f48b1", "time": 1564305081, "bits": 1, "fee": 0, "nonce": 2, "size": 274, "tx": [{ "hash": "a0b2f8c9b6037982d5b8a83db22c30e187fcb446127d0ad54640c4b8d67f48b1", "version": 1, "in": [{ "hash": "0000000000000000000000000000000000000000000000000000000000000000", "index": 4294967295, "sig": "473046022100b7816cac60f40398d42acea16086a481eea79e9e969003e1db4715e50c62af32022100a2b28f6ddf60024a660e6cd51c558de69ec455f00b3c4e6c61d27d55f0ae1da6014102aa443931cceeadbbf591f60dceb47b7051045c29d3130203532e7112fbe6a6e9", "seq": 4294967295 }], "out": [{ "amount": 50000000000, "address": "oRtMcVvWj9ZQiZ4BAdmKDkNuinYaxSfKXA", "script": "76a91462e907b15cbf27d5425399ebf6f0fb50ebb88f1888ac" }], "fee": 0, "size": 193, "coinbase": 1 }] });
    //console.log('msg:', msg);
    //app.network.protocol.initNode("morty.node.orwellscan.org//19841");


})


app.init();