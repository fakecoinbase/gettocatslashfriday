
class handler {
    constructor(app) {
        this.app = app;
    }
    init() {
        this.app.on("handler.message", (data) => {

            if (this.app.cnf("debug").handler)
                this.app.debug("info", "handler", data.type, data.data, "self: " + data.self, data.rinfo)

            this.app.emit("handler." + data.type, data.data, data.rinfo, data.self);

        });

        require('./listeners'+this.app.cnf('network'))(this.app);

    }

}

module.exports = handler;