const http = require('http');
const argv = require('minimist')(process.argv.slice(2));

let Client = function (opts) {
    if (!opts)
        opts = {};

    let options = {
        host: opts.host || 'localhost',
        path: opts.path || '/',
        port: opts.port || '49999',
        method: opts.method || 'POST',
        timeout: 10000
    };

    this.send = function (method, params, callback) {
        let data = {
            'method': method,
            'params': params,
        }

        if (!callback)
            callback = stdout;

        let cb = function (response) {
            let str = '';
            response.on('data', function (chunk) {
                str += chunk;
            });

            response.on('end', function () {
                callback(1, JSON.parse(str));
            });

            response.on('error', function (err) {
                callback(0, err);
            });
        }

        let req = http.request(options, cb);
        req.on("error", function (err) {
            callback(0, err);
        })

        req.write(JSON.stringify(data));
        req.end();

    }

}

let stdout = function (status, res) {
    if (status)
        console.log(JSON.stringify(res, null, " "))
    else
        console.log(JSON.stringify({ code: -1, message: 'cant connect to server' }))

    process.exit(0)
}

let func = function (conf, cb, cmd, params) {
    if (!cmd)
        cmd = argv._.shift();

    if (!params)
        params = argv._;

    const client = new Client(conf);
    if (!cmd)
        cmd = 'help';

    if (!cb)
        cb = stdout;

    client.send(cmd, params, cb);

}


module.exports = func;