let app = require('./testinstance');

app.loadModule('config');
let config = require('../config.json');
config.tests = ['miner'];//initialize only this modules
config.pow.algo = 'sha256';
app.loadConfig(config);

app.loadToolset('crypto');
app.loadToolset('tools');
app.loadModule('networkhandler');
app.loadModule('pow');
app.loadModule('db');
app.loadModule('state');
app.loadModule('miner');
app.loadModule('chain');
app.loadModule('wallet');
app.loadModule('network');


app.miner.start();