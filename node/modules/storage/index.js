/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
const loki = require('lokijs');

class Storage {

    constructor(app) {
        this.app = app;
        this.dbname = 'chain.dat';
        this.path = this.app.config.getLocalHomePath();
        this.db = null;
    }
    init() {
        this.app.debug("info", "storage", "initialization storage started");
        return new Promise((resolve, reject) => {
            if (!this.db) {
                this.app.debug("info", "storage", "initialization db");

                let opts = {
                    //adapter: cryptoadapter,
                    //adapter: new lfsa(),
                    autoload: true,
                    autoloadCallback: () => {
                        this.app.debug("info", "storage", "db initialization complete");

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
                    autosaveInterval: 100
                };

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

}

module.exports = Storage;