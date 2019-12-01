const rpc = require('node-json-rpc');

class Rpc {

    constructor(app) {
        this.app = app;
        this.serv = null;
        this.methods = [];
    }
    init() {
        if (this.app.cnf('rpc').useServer)
            this.app.debug("info", "rpc", "init rpc server")
        else
            this.app.debug("info", "rpc", "rpc server is disabled")
    }
    error(code, message) {
        return ([({ code: code, error: message }), null])
    }
    success(data) {
        return ([null, data])
    }
    addMethod(name, callback) {
        if (this.app.cnf('debug').rpc)
            this.app.debug("info", "rpc", "add method handler", name);

        this.methods[name] = callback;
    }
    start() {
        if (!this.serv) {
            this.serv = new rpc.Server(this.app.cnf('rpc').server);

            this.updateMethods();
            this.serv.start((error) => {
                if (this.app.cnf('debug').rpc)
                    this.app.debug("info", "rpc", "starting server: " + ((error) ? "fail" : "success"))

                if (error)
                    throw error;
                else {
                    if (this.app.cnf('debug').rpc)
                        this.app.debug("info", "rpc", 'RPC server running ...');

                    this.app.emit("rpc.server.start", this.serv)
                }
            });
        }

        return this.serv;

    }
    _handler(name, params, cb) {
        if (!params)
            params = [];

        //if (this.app.cnf('debug').rpc)
        this.app.debug("info", "rpc", 'handled ' + name);

        let res = this.methods[name](params, cb)
        if (res != -1) {
            if (!res)
                res = [];

            cb.apply(null, res);
        }
    }
    updateMethods() {
        let items = [];
        let methods = this.methods;

        for (let i in methods) {
            items.push(i);
            let cb = new Function('handler', 'rpc', 'return function (params, callback) {handler.apply(rpc, [\'' + i + '\', params, callback]);}');
            this.serv.addMethod(i, cb(this._handler, this));
        }

        if (this.app.cnf('debug').rpc)
            this.app.debug("info", "rpc", "added methods " + items.join(","));
    }


}

Rpc.INVALID_RESULT = 0x1;
Rpc.INVALID_PARAMS = 0x2;

module.exports = Rpc