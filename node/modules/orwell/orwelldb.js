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
            if (!db.cache[this.dbname]) {
                let cnf = this.app.cnf('orwelldb');
                cnf.name = this.dbname;
                cnf.public_key = this.pk;
                cnf.path = cnf.path.replace("%home%", this.app.config.getLocalHomePath())
                this.app.config.initDir(cnf.path);
                db.cache[this.dbname] = cnf;
            }

            return db.cache[this.dbname];
        }
        static import(databasename, public_key, hex) {
            let cnf = new db(databasename, public_key).getConfig();
            return orwell.import(cnf, hex);
        }
        static export(databasename, public_key, cb) {
            let cnf = new db(databasename, public_key).getConfig();
            return orwell.export(cnf, cb);
        }
        static syncdb(dbname) {

            return new Promise((resolve, reject) => {

                let arr = this.app.orwell.getDatascriptList(dbname, true);

                let done = () => {
                    resolve();
                }

                let next = (index, a) => {
                    if (!a[index] && a.length >= index)
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