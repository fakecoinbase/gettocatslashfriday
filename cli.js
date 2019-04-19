let DAPP = require("./node/index");
let cnf = require('./config.btc-chain.json');
let cli_cnf = cnf[cnf.network].rpc.client;
DAPP.cli(cli_cnf);
