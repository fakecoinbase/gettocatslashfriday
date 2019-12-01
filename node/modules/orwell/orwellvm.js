const orwell = require('orwelldb');
const $ = orwell.$;

module.exports = function (app) {

    class db {
        constructor(databasename, public_key) {
            this.dbname = databasename;
            this.pk = public_key;
            let cnf = this.getConfig()
            return $(cnf);
        }
        getConfig() {
            return this.getConfigParams(this.dbname);
        }
        static getConfigParams(dbname, pk) {
            if (!db.cache[dbname]) {
                let cnf = app.cnf('orwelldb');
                cnf.name = dbname;
                cnf.public_key = pk;
                cnf.path = cnf.path.replace("%home%", app.config.getLocalHomePath())
                app.config.initDir(cnf.path);
                db.cache[dbname] = cnf;
            }

            return db.cache[dbname];
        }
        static import(databasename, public_key, hex) {
            let cnf = db.getConfigParams(databasename, public_key);
            return orwell.import(cnf, hex);
        }
        static export(databasename, public_key, cb) {
            let cnf = db.getConfigParams(databasename, public_key);
            return orwell.export(cnf, cb);
        }
        static syncdb(dbname) {

            return new Promise((resolve, reject) => {

                let arr = app.orwell.getDatascriptList(dbname, true);
                let done = () => {
                    resolve();
                }

                let next = (index, a) => {
                    if (!a[index] && index >= a.length)
                        return done();

                    this.import(dbname, a[index].writer, a[index].ds)
                        .then(() => {
                            next(index + 1, a);
                        })
                        .catch((e) => {
                            next(index + 1, a)
                        })

                }

                next(0, arr)

            });


        }
    }

    db.cache = {};

    return db;
}