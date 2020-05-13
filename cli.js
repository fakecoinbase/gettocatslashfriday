let DAPP = require("./node/index");
let cnf = require('./config.json');
let cli_cnf = cnf[cnf.network].rpc.client;
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
