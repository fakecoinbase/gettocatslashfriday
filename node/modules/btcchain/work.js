module.exports = (app) => {
    class MiningWork extends app.storage.Index {
        constructor() {
            super(app, 'mining', true);
            this.init();
        }

        createWorkId(prevblockhash, height, bits, txcount) {
            return app.tools.bitPony.tool.sha256(Buffer.concat([
                app.tools.bitPony.var_int.write(txcount),
                new Buffer(prevblockhash, 'hex'),
                app.tools.bitPony.var_int.write(height),
                app.tools.bitPony.var_int.write(typeof bits == 'string' ? parseInt(bits, 16) : bits)
            ])).toString('hex')
        }
    }

    return MiningWork;
}