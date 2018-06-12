let app = require('./testinstance');

app.loadModule('config');
let config = require('../config.json');
config.tests = ['network','networkhandler', 'chain', 'db', 'miner', 'wallet'];//initialize only this modules
config.pow.algo = 'sha256';
app.loadConfig(config);



app.loadModule('networkhandler');
app.loadModule('pow');
app.loadModule('db');
app.loadModule('wallet');
app.loadModule('state');
app.loadModule('miner');
app.loadModule('chain');
app.loadModule('network');

setTimeout(() => {
    
    app.network.protocol.initNode("morty.node.orwellscan.org//19840", function () {
        console.log('connected!');
        app.miner.start();
    });

}, 10000);

