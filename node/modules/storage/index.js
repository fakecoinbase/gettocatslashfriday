const Storage = require('./storage');
const Entity = require('./entity');
const Index = require('./index.entity');

class StorageFactory {
    constructor(app) {

        this.chain = new Storage(app, 'chain.dat');
        this.index = new Storage(app, 'index.dat');

        this.Entity = Entity;
        this.Index = Index;

    }
    init() {
        return Promise.all([
            this.chain.init(),
            this.index.init(),
        ])
    }
    getConnection(type) {
        if (!type || type == 'chain')
            return this.chain.getConnection();
        else
            return this.index.getConnection();
    }
    getCollection(name, type) {
        let db = null;
        if (!type || type == 'chain')
            db = this.chain;
        else
            db = this.index;

        return db.getCollection(name);
    }
}

module.exports = StorageFactory;