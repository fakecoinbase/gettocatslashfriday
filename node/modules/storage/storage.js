/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
const loki = require('lokijs');
const adapter = require('./cryptoadapter');

class Storage {
    constructor(app, dbname, encrypted) {
        this.app = app;
        this.dbname = dbname ? dbname : 'chain.dat';
        this.path = this.app.config.getLocalHomePath();
        this.encrypted = !!encrypted;
        this.secret = encrypted;
        this.db = null;
    }
    init() {
        this.app.debug("info", "storage", "initialization storage started", this.dbname);
        return new Promise((resolve, reject) => {
            if (!this.db) {
                this.app.debug("info", "storage", "initialization db", this.dbname);

                let opts = {
                    autoload: true,
                    autoloadCallback: () => {
                        this.app.debug("info", "storage", "db initialization complete", this.dbname);

                        this.db.gc = (name) => {
                            let coll = this.db.getCollection(name);
                            if (coll === null) {
                                coll = this.db.addCollection(name, { clone: true });
                            }

                            return coll;
                        }

                        resolve(this.db);
                    },
                    autosave: true,
                    autosaveInterval: 1000
                };

                //if (this.encrypted)
                //    opts.adapter =  new adapter(this.secret);

                this.db = new loki(this.path + '/' + this.dbname, opts);
                this.app.on("app.exit", () => {
                    this.app.debug("info", "storage", "stop db");
                    if (this.db)
                        this.db.close();
                })

            } else
                resolve(this.db);
        });
    }
    getConnection() {
        return this.db;
    }
    getCollection(name) {
        return this.db.gc(name);
    }

}

module.exports = Storage;