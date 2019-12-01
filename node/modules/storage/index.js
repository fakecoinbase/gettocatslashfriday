const Storage = require('./storage');
const Entity = require('./entity');
const Index = require('./index.entity');

class StorageFactory {
    constructor(app) {

        this.chain = new Storage(app, 'chain.dat');
        this.index = new Storage(app, 'index.dat');
        this.datascript = new Storage(app, 'datascript.dat');
        this.keystore = new Storage(app, 'keystore.dat', true);//todo: encrypt data

        this.Entity = Entity;
        this.Index = Index;

    }
    init() {
        return Promise.all([
            this.chain.init(),
            this.index.init(),
            this.datascript.init(),
            this.keystore.init(),
        ])
    }
    getConnection(type) {
        if (!type || type == 'chain')
            return this.chain.getConnection();
        else if (type == 'wallet')
            return this.keystore.getConnection();
        else if (type == 'datascript')
            return this.datascript.getConnection();
        else
            return this.index.getConnection();
    }
    getCollection(name, type) {
        let db = null;
        if (!type || type == 'chain')
            db = this.chain;
        else if (type == 'datascript')
            db = this.datascript;
        else if (type == 'wallet')
            db = this.keystore;
        else
            db = this.index;

        return db.getCollection(name);
    }
}

module.exports = StorageFactory;