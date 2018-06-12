const walletdb = require('./db')

class wallet {
    constructor(app) {
        this.app = app;
        this.db = new walletdb(app);
    }
    init() {
        this.getAccount("0");
    }
    createAccount(id, force) {

        if (!this.findAddrByAccount(id) || force) {
            let privateKey, publicKey;
            let data = this.app.crypto.createKeyPair();

            privateKey = data.private;
            publicKey = data.public;

            let addr = this.app.crypto.generateAddress(publicKey);
            let obj = { hash: id, added: new Date().getTime() / 1000, address: addr, publicKey: publicKey, privateKey: privateKey };
            let vals = this.db.get(id);

            if (!vals || (Object.keys(vals).length === 0 && vals.constructor === Object))
                vals = [];
            vals.unshift(obj);
            this.db.set(id, vals);
            this.addDataListener(publicKey);
            return obj
        } else
            return this.findAddrByAccount(id);

    }
    haveAccount(id) {
        var obj = this.findAddrByAccount(id);
        if (!obj)
            return false;
        return true;
    }
    getAccount(id) {

        var obj = this.findAddrByAccount(id);
        if (!obj)
            obj = this.createAccount(id);

        return obj;

    }
    findAddrByAccount(id) {
        var obj = this.db.get(id);
        return obj[0] || false;
    }
    getAllPublicKeys() {
        let arr = [];
        let list = this.db.list();
        for (let i in list) {
            if (list[i] && list[i] instanceof Array && list[i].length > 0)
                for (let k in list[i]) {
                    arr.push(list[i][k].publicKey);
                }
        }

        return arr;
    }
    addDataListener(key) {
        let checkSum = this.app.crypto.sha256(new Buffer(key, 'hex')).slice(0, 4).toString("hex");
        this.app.on("data" + checkSum, (tx) => {
            this.app.emit("data", tx, checkSum);
        });
    }
}



module.exports = wallet;