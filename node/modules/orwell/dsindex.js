const dscript = require('orwelldb').datascript;
module.exports = (app) => {
    class dsIndex extends app.storage.Index {
        constructor() {
            super(app, 'datascript', false, 'datascript');
            this.init();
        }
        addDatascript(tx, options) {
            let index = this.get("tx/" + tx.hash);
            if (index)
                return false;

            let cnt = 0;
            let h = app.orwell.SCRIPT.sigToArray(tx.in[0].sig);
            let publicKey = h.publicKey;
            let address = app.orwell.SCRIPT.scriptToAddr(tx.out[0].scriptPubKey || tx.out[0].script);
            let database = app.orwell.SCRIPT.scriptToAddrHash(tx.out[0].scriptPubKey || tx.out[0].script).toString('hex');
            let dslist = [];

            for (let k in tx.datascript) {
                let data = new dscript(tx.datascript[k]).toJSON();
                data.writer = publicKey;
                if (!dslist[data.dataset])
                    dslist[data.dataset] = [];

                data.writer = publicKey;
                data.database = database;
                data.writerAddress = address;
                data.tx = tx.hash;
                dslist[data.dataset].push(data);
            }


            let setlist = this.get(database);
            if (!setlist || !(setlist instanceof Array))
                setlist = [];

            for (let dtset in dslist) {
                setlist.push(dtset);
                let oldlist = this.get(database + "/" + dtset);
                if (!oldlist || !(oldlist instanceof Array))
                    oldlist = [];

                let datalist = this.get("data/" + database + "/" + dtset);
                if (!datalist || !(datalist instanceof Array))
                    datalist = [];

                let settingslist = this.get("settings/" + database + "/" + dtset);
                if (!settingslist || !(settingslist instanceof Array))
                    settingslist = [];

                let createlist = this.get("create/" + database);
                if (!createlist || !(createlist instanceof Array))
                    createlist = [];

                for (let j in dslist[dtset]) {
                    cnt++;
                    let data = dslist[dtset][j];
                    if (!data.content.owner_key && data.operator == 'settings')
                        data.content.owner_key = publicKey;
                    oldlist.push(data);
                    if (data.operator == 'write') {
                        this.addSpecialData(database, data);
                        datalist.push(data.content);
                    }

                    if (data.operator == 'settings' || data.operator == 'create')
                        settingslist.push(data.content);

                    if (data.operator == 'create')
                        createlist.push(data);
                }

                this.set(database + "/" + dtset, oldlist);
                this.set("data/" + database + "/" + dtset, datalist);
                this.set("settings/" + database + "/" + dtset, settingslist);
                this.set("create/" + database, createlist);
                app.debug("info", "dsindex", "added dsindex for tx: " + tx.hash + " count: ", cnt);
            }

            if (!cnt)
                cnt = -1;

            this.set(database, Array.from(new Set(setlist)));
            this.set("tx/" + tx.hash, cnt);
            return true;
        }
        getDataSets(dbname) {
            let setlist = this.get(dbname);
            let arr = {};
            for (let k in setlist) {
                arr[setlist[k]] = this.get(dbname + "/" + setlist[k]) || [];
            }

            return arr;
        }
        getDataSetsCreation(dbname) {
            return this.get("create/" + dbname) || [];
        }
        getDataSetCreationRecord(dbname, dataset) {
            return this.get("settings/" + dbname + "/" + dataset)[0];//first record is creation
        }
        getDataSetsSettingsLast(dbname, dataset) {
            let sett = this.get("settings/" + dbname + "/" + dataset);
            return sett[sett.length - 1];//last record is actual settings
        }
        getData(dbname, dataset) {
            return this.get(dbname + "/" + dataset);
        }
        getRecords(dbname, dataset) {
            return this.get("data/" + dbname + "/" + dataset);
        }
        addSpecialData(database, data) {
            if (database == app.cnf('orwelldb').systemAddress) {

                if (data.dataset == 'domain') {
                    this.set("domain/" + data.content.domain, data.content.address);
                    this.set("domain/address/" + data.content.address, data.content.domain);
                }

                if (data.dataset == 'tokens') {
                    this.set("token/" + data.content.ticker, data.content.address);
                    this.set("token/address/" + data.content.address, data.content.ticker);
                    this.set("token/data/" + data.content.ticker, data.content);
                }

            }

            //address token db
            let ticker = this.get("token/address/" + database);
            if (ticker && content.dataset == 'token') {
                let opts = this.get("token/data/" + ticker);
                //balance by address ?
                //balance history by address
                let history = this.get(data.content.from + "/token/" + ticker + "/history");
                if (!history)
                    history = [];

                history.push(content.data);
                this.set(data.content.from + "/token/" + ticker + "/history", history);

                let balance = this.get(data.content.to + "/token/" + ticker);
                if (!balance)
                    balance = 0;
                balance += data.content.amount;
                this.set(data.content.to + "/token/" + ticker);

                if (data.content.from != data.content.to) {//initial pay hack
                    history = this.get(data.content.to + "/token/" + ticker + "/history");
                    if (!history)
                        history = [];

                    history.push(content.data);
                    this.set(data.content.to + "/token/" + ticker + "/history", history);

                    balance = this.get(data.content.from + "/token/" + ticker);
                    if (!balance)
                        balance = 0;
                    balance -= data.content.amount;
                    this.set(data.content.from + "/token/" + ticker);
                }


            }



        }
    }

    return dsIndex;
}
