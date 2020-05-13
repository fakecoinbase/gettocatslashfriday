
class handler {
    constructor(app) {
        this.app = app;
    }
    init() {
        this.app.on("handler.message", (data) => {
            this.app.debug("info", "handler", data.type, data.data, "self: " + data.self, data.rinfo)
            this.app.emit("handler." + data.type, data.data, data.rinfo, data.self, data.sign);
        });

        require('./listeners' + this.app.cnf('network'))(this.app);

    }

}

module.exports = handler;