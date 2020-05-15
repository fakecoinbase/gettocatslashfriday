const mixin = require("mixin-deep");
const DAPP = require("./node/index");
const cnf = require('./config.json');

let opts = mixin(DAPP.prototype.getDefaultConfig(), cnf);
let cli_cnf = opts.rpc.server;

DAPP.cli(cli_cnf, function (status, res) {
    if (status) {
        if (typeof res.result == 'string')
            console.log(res.result)
        else if (res.result)
            console.log(JSON.stringify(res.result, null, " "))
        else
            console.log(JSON.stringify(res.error, null, " "))
    } else
        console.log(JSON.stringify({ code: -1, message: 'cant connect to server' }))

    process.exit(0)
});
