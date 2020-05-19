const dscript = require('orwelldb').datascript;
module.exports = (app) => {
    class dsIndex extends app.storage.Index {
        constructor() {
            super(app, 'datascript', false, 'datascript');
            this.init();
        }
        addDatascript(tx, options) {
            let promise = Promise.resolve();
            let index = this.get("tx/" + tx.hash);
            if (index)
                return promise;

            let cnt = 0;
            let publicKey = tx.s[0][1];
            let address = tx.out[0].address;
            let database = app.orwell.ADDRESS.getPublicKeyHashByAddress(tx.out[0].address).toString('hex');
            let dslist = [];

            let ds = dscript.readArray(tx.ds);

            for (let k in ds) {
                let data = new dscript(ds[k]).toJSON();
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
                promise = promise.then(() => {

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

                    let m = Promise.resolve();
                    setlist.push(dtset);

                    for (let j in dslist[dtset]) {
                        cnt++;
                        let data = dslist[dtset][j];
                        if (!data.content.owner_key && data.operator == 'settings')
                            data.content.owner_key = publicKey;
                        oldlist.push(data);

                        if (data.operator == 'write') {
                            m = m.then(() => { return this.addSpecialData(database, data) });
                            datalist.push(data.content);
                        }

                        if (data.operator == 'settings' || data.operator == 'create')
                            settingslist.push(data.content);

                        if (data.operator == 'create') {
                            createlist.push(data);
                        }
                    }

                    if (!cnt)
                        cnt = -1;

                    return Promise.all([
                        m,
                        this.set(database + "/" + dtset, oldlist),
                        this.set("data/" + database + "/" + dtset, datalist),
                        this.set("settings/" + database + "/" + dtset, settingslist),
                        this.set("create/" + database, createlist),
                        this.set(database, Array.from(new Set(setlist))),
                        this.set("tx/" + tx.hash, cnt)
                    ])
                }).then(() => {
                    app.debug("info", "dsindex", "added dsindex for tx: " + tx.hash + " count: ", cnt);
                    return Promise.resolve();
                })
            }

            return promise;
        }
        removeDataScript(tx, options) {
            let promise = Promise.resolve();
            let index = this.get("tx/" + tx.hash);
            if (!index)
                return promise;

            let cnt = 0;
            let publicKey = tx.s[0][1];
            let address = tx.out[0].address;
            let database = app.orwell.ADDRESS.getPublicKeyHashByAddress(tx.out[0].address).toString('hex');
            let dslist = [];

            let ds = dscript.readArray(tx.ds);

            for (let k in ds) {
                let data = new dscript(ds[k]).toJSON();
                data.writer = publicKey;
                if (!dslist[data.dataset])
                    dslist[data.dataset] = [];

                data.writer = publicKey;
                data.database = database;
                data.writerAddress = address;
                data.tx = tx.hash;

                let indx = dslist[data.dataset].indexOf(data);
                if (indx != -1)
                    dslist[data.dataset].splice(indx, 1);
            }

            let setlist = this.get(database);
            if (!setlist || !(setlist instanceof Array))
                setlist = [];

            for (let dtset in dslist) {
                promise = promise.then(() => {

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

                    let m = Promise.resolve();
                    let indx2 = setlist.indexOf(dtset);
                    if (indx2 != -1)
                        setlist.splice(indx2, 1);

                    for (let j in dslist[dtset]) {
                        cnt++;
                        let data = dslist[dtset][j];
                        if (!data.content.owner_key && data.operator == 'settings')
                            data.content.owner_key = publicKey;

                        let indx3 = oldlist.indexOf(data);
                        if (indx3 != -1)
                            oldlist.splice(indx3, 1);

                        if (data.operator == 'write') {
                            m = m.then(() => { return this.removeSpecialData(database, data) });
                            let indx4 = datalist.indexOf(data.content);
                            if (index4 != -1)
                                datalist.splice(indx4, 1);
                        }

                        if (data.operator == 'settings' || data.operator == 'create') {
                            let indx5 = settingslist.indexOf(data.content);
                            if (indx5 != -1)
                                settingslist.splice(indx5, 1);
                        }

                        if (data.operator == 'create') {
                            let indx6 = createlist.indexOf(data);
                            if (indx6 != -1)
                                createlist.splice(indx6, 1);
                        }
                    }

                    if (!cnt)
                        cnt = -1;

                    return Promise.all([
                        m,
                        this.set(database + "/" + dtset, oldlist),
                        this.set("data/" + database + "/" + dtset, datalist),
                        this.set("settings/" + database + "/" + dtset, settingslist),
                        this.set("create/" + database, createlist),
                        this.set(database, Array.from(new Set(setlist))),
                        this.remove("tx/" + tx.hash)
                    ])
                }).then(() => {
                    app.debug("info", "dsindex", "remove dsindex for tx: " + tx.hash + " count: ", cnt);
                    return Promise.resolve();
                })
            }

            return promise;
        }
        getDomainsList() {
            let result = this.find({ 'key': { '$contains': "domain/key/" } }, ["value", true]);
            let list = [];
            for (let i in result) {
                list.push(result[i].value);
            }

            return list;
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
        getMasternodes() {
            return this.get("masternodes") || [];
        }
        getMasternode(publickey) {
            return this.get('masternode/' + publickey);
        }
        getTokenSettings(ticker) {
            return this.get("token/data/" + ticker)
        }
        getTokenAddress(ticker) {
            return this.get("token/" + ticker)
        }
        getTokenTicker(address) {
            return this.get("token/address/" + address)
        }
        getTokenBalance(token, address) {
            return this.get(address + "/token/" + token)
        }
        getTokenHistory(token, address) {
            return this.get(address + "/token/" + token + "/history")
        }
        getTokenHolders(ticker) {
            return this.get("token/holders/" + ticker)
        }
        getStockTicker(address) {
            return this.get("stock/address/" + address);
        }
        getTokenList() {
            let result = this.find({ 'key': { '$contains': "token/address/" } }, ["value", true]);
            let list = [];
            for (let i in result) {
                list.push(result[i].value);
            }

            return list;
        }
        getTokensBalance(address) {
            let result = this.find({ 'key': { '$contains': address + "/token/" } }, ["value", true]);
            let balances = {};

            let tokens = this.getTokenList();
            for (let i in tokens) {
                if (!balances[tokens[i]])
                    balances[tokens[i]] = 0;
            }

            for (let i in result) {
                let val = result[i];
                if (val.key.indexOf("/history") != -1)
                    continue;

                let tokenName = val.key.split("/")[2];
                balances[tokenName] = val.value;
            }

            return balances;
        }
        getTokensHistory(address) {
            let result = this.find({ 'key': { '$contains': address + "/token/" } }, ["value", true]);
            let history = {};

            let tokens = this.getTokenList();
            for (let i in tokens) {
                if (!history[tokens[i]])
                    history[tokens[i]] = [];
            }

            for (let i in result) {
                let val = result[i];
                if (val.key.indexOf("/history") == -1)
                    continue;

                let tokenName = val.key.split("/")[2];
                history[tokenName] = val.value;
            }


            return history;
        }
        getTokenHistoryAll(ticker) {
            return this.get("all/token/" + ticker + "/history") || [];
        }
        getAddressHistoryAll(address) {
            return this.get("all/" + address + "/tokens/history");
        }
        addSpecialData(database, data) {
            let promise = Promise.resolve();
            let dbaddress = app.orwell.ADDRESS.generateAddressFromAddrHash(database);
            if (dbaddress == app.orwell.getSystemAddress()) {

                if (data.dataset == 'domains') {
                    promise = promise.then(() => { return this.set("domain/" + data.content.domain, data.content.key); });
                    promise = promise.then(() => { return this.set("domain/key/" + data.content.key, data.content.domain); });
                    promise = promise.then(() => { return this.set("domain/address/" + app.orwell.ADDRESS.generateAddressFromPublicKey(data.content.key), data.content.domain); });
                }

                if (data.dataset == 'masternodes') {
                    promise = promise.then(() => { return this.set("masternode/" + data.content.key, data.content); });
                    promise = promise.then(() => {
                        let mnlist = this.get("masternodes");
                        if (!mnlist)
                            mnlist = [];
                        mnlist.push(data.content.key);
                        if (data.content.remove) {
                            if (this.app.orwell.getAddressBalance(this.app.orwell.createAddressHashFromPublicKey(data.content.key)) < app.cnf('consensus').masternodeAmount) {
                                mnlist.splice(mnlist.indexOf(data.content.key), 1);
                            }
                        }
                        mnlist = mnlist.filter((v, i, a) => a.indexOf(v) === i);
                        return this.set("masternodes", mnlist);
                    });
                }

                if (data.dataset == 'tokens') {
                    promise = promise.then(() => { return this.set("token/" + data.content.ticker, data.content.address); });
                    promise = promise.then(() => { return this.set("token/address/" + data.content.address, data.content.ticker); });
                    promise = promise.then(() => { return this.set("token/data/" + data.content.ticker, data.content); });
                    promise = promise.then(() => { return this.set("token/systemdata/" + data.content.ticker, data); });

                    if (data.content.isStock) {
                        promise = promise.then(() => { return this.set("stock/" + data.content.ticker, data.content.address); });
                        promise = promise.then(() => { return this.set("stock/address/" + data.content.address, data.content.ticker); });
                        promise = promise.then(() => { return this.set("stock/data/" + data.content.ticker, data.content); });
                    }
                }

            }

            //address token db
            promise = promise.then(() => {
                let prms = Promise.resolve();
                let ticker = this.get("token/address/" + dbaddress);

                if (ticker && data.dataset == 'token') {
                    let opts = this.get("token/data/" + ticker);
                    //balance by address ?
                    //balance history by address

                    prms = prms.then(() => {
                        let history = this.get(data.content.from + "/token/" + ticker + "/history");
                        if (!history)
                            history = [];

                        history.push(data.content);
                        return this.set(data.content.from + "/token/" + ticker + "/history", history);
                    });

                    if (data.content.to && data.content.from != data.content.to)
                        prms = prms.then(() => {
                            let history = this.get("all/" + data.content.from + "/tokens/history");
                            if (!history)
                                history = [];

                            let d = data.content;
                            d.ticker = ticker;
                            history.push(d);
                            return this.set("all/" + data.content.from + "/tokens/history", history);
                        });

                    prms = prms.then(() => {
                        let history = this.get("all/token/" + ticker + "/history");
                        if (!history)
                            history = [];

                        history.push(data.content);
                        return this.set("all/token/" + ticker + "/history", history);
                    });

                    prms = prms.then(() => {
                        let balance = this.get(data.content.to + "/token/" + ticker);
                        if (!balance)
                            balance = 0;
                        balance += parseFloat(data.content.amount);
                        return this.set(data.content.to + "/token/" + ticker, balance);
                    });
                    prms = prms.then(() => {
                        let balance = this.get(data.content.to + "/token/" + ticker);
                        if (!balance)
                            balance = 0;
                        balance += parseFloat(data.content.amount);
                        return this.set(data.content.to + "/token/" + ticker, balance);
                    });

                    prms = prms.then(() => {

                        let tokenHolders = this.get("token/holders/" + ticker);
                        if (!tokenHolders)
                            tokenHolders = [dbaddress];

                        tokenHolders.push(data.content.to);
                        tokenHolders = tokenHolders.filter((v, i, a) => a.indexOf(v) === i);

                        //TODO: index holder send last tokens
                        if (data.content.to && data.content.from != data.content.to) {
                            let fromBalance = this.getTokenBalance(ticker, data.content.from) || 0;
                            fromBalance -= parseFloat(data.content.amount);

                            if (fromBalance <= 0)
                                tokenHolders.splice(tokenHolders.indexOf(data.content.from), 1);
                        }

                        return this.set("token/holders/" + ticker, tokenHolders);
                    });


                    if (data.content.from != data.content.to) {//initial pay hack
                        prms = prms.then(() => {
                            let history = this.get(data.content.to + "/token/" + ticker + "/history");
                            if (!history)
                                history = [];

                            history.push(data.content);
                            return this.set(data.content.to + "/token/" + ticker + "/history", history);
                        });

                        prms = prms.then(() => {
                            let balance = this.get(data.content.from + "/token/" + ticker);
                            if (!balance)
                                balance = 0;
                            balance -= parseFloat(data.content.amount);
                            return this.set(data.content.from + "/token/" + ticker, balance);
                        });
                    }

                    prms = prms.then(() => {
                        let history = this.get("all/" + data.content.to + "/tokens/history");
                        if (!history)
                            history = [];

                        let d = data.content;
                        d.ticker = ticker;
                        history.push(d);
                        return this.set("all/" + data.content.to + "/tokens/history", history);
                    });

                }

                return prms;
            })

            return promise;
        }
        removeSpecialData(database, data) {
            let promise = Promise.resolve();
            let dbaddress = app.orwell.ADDRESS.generateAddressFromAddrHash(database);
            if (dbaddress == app.orwell.getSystemAddress()) {

                if (data.dataset == 'domains') {
                    promise = promise.then(() => { return this.remove("domain/" + data.content.domain); });
                    promise = promise.then(() => { return this.remove("domain/key/" + data.content.key); });
                    promise = promise.then(() => { return this.remove("domain/address/" + app.orwell.ADDRESS.generateAddressFromPublicKey(data.content.key)); });
                }

                if (data.dataset == 'masternodes') {
                    promise = promise.then(() => { return this.remove("masternode/" + data.content.key); });
                    promise = promise.then(() => {
                        let mnlist = this.get("masternodes");
                        if (!mnlist)
                            mnlist = [];

                        let indx = mnlist.indexOf(data.content.key);
                        if (indx != -1)
                            mnlist.splice(indx, 1);

                        if (data.content.remove) {
                            if (this.app.orwell.getAddressBalance(this.app.orwell.createAddressHashFromPublicKey(data.content.key)) < app.cnf('consensus').masternodeAmount) {
                                mnlist.push(data.content.key);
                            }
                        }

                        mnlist = mnlist.filter((v, i, a) => a.indexOf(v) === i);
                        return this.set("masternodes", mnlist);
                    });
                }

                if (data.dataset == 'tokens') {
                    promise = promise.then(() => { return this.remove("token/" + data.content.ticker); });
                    promise = promise.then(() => { return this.remove("token/address/" + data.content.address); });
                    promise = promise.then(() => { return this.remove("token/data/" + data.content.ticker); });
                    promise = promise.then(() => { return this.remove("token/systemdata/" + data.content.ticker); });

                    if (data.content.isStock) {
                        promise = promise.then(() => { return this.remove("stock/" + data.content.ticker); });
                        promise = promise.then(() => { return this.remove("stock/address/" + data.content.address); });
                        promise = promise.then(() => { return this.remove("stock/data/" + data.content.ticker); });
                    }
                }

            }

            //address token db
            promise = promise.then(() => {
                let prms = Promise.resolve();
                let ticker = this.get("token/address/" + dbaddress);

                if (ticker && data.dataset == 'token') {
                    let opts = this.get("token/data/" + ticker);
                    //balance by address ?
                    //balance history by address

                    prms = prms.then(() => {
                        let history = this.get(data.content.from + "/token/" + ticker + "/history");
                        if (!history)
                            history = [];

                        let indx = history.indexOf(data.content);
                        if (indx != -1)
                            history.splice(indx, 1);

                        return this.set(data.content.from + "/token/" + ticker + "/history", history);
                    });

                    if (data.content.to && data.content.from != data.content.to)
                        prms = prms.then(() => {
                            let history = this.get("all/" + data.content.from + "/tokens/history");
                            if (!history)
                                history = [];

                            let d = data.content;
                            d.ticker = ticker;

                            let indx = history.indexOf(d);
                            if (indx != -1)
                                history.splice(indx, 1);

                            return this.set("all/" + data.content.from + "/tokens/history", history);
                        });

                    prms = prms.then(() => {
                        let history = this.get("all/token/" + ticker + "/history");
                        if (!history)
                            history = [];

                        let indx = history.indexOf(data.content);
                        if (indx != -1)
                            history.splice(indx, 1);

                        return this.set("all/token/" + ticker + "/history", history);
                    });

                    prms = prms.then(() => {
                        let balance = this.get(data.content.to + "/token/" + ticker);
                        if (!balance)
                            balance = 0;
                        balance -= parseFloat(data.content.amount);
                        return this.set(data.content.to + "/token/" + ticker, balance);
                    });
                    prms = prms.then(() => {
                        let balance = this.get(data.content.to + "/token/" + ticker);
                        if (!balance)
                            balance = 0;
                        balance -= parseFloat(data.content.amount);
                        return this.set(data.content.to + "/token/" + ticker, balance);
                    });

                    prms = prms.then(() => {

                        let tokenHolders = this.get("token/holders/" + ticker);
                        if (!tokenHolders)
                            tokenHolders = [dbaddress];

                        let indx = tokenHolders.indexOf(data.content.to);
                        if (indx != -1)
                            tokenHolders.splice(indx, 1);

                        tokenHolders = tokenHolders.filter((v, i, a) => a.indexOf(v) === i);

                        //TODO: index holder send last tokens
                        if (data.content.to && data.content.from != data.content.to) {
                            let fromBalance = this.getTokenBalance(ticker, data.content.from) || 0;
                            fromBalance += parseFloat(data.content.amount);

                            if (tokenHolders.indexOf(data.content.from) == -1) {
                                tokenHolders.push(data.content.from);
                            }
                        }

                        return this.set("token/holders/" + ticker, tokenHolders);
                    });


                    if (data.content.from != data.content.to) {//initial pay hack
                        prms = prms.then(() => {
                            let history = this.get(data.content.to + "/token/" + ticker + "/history");
                            if (!history)
                                history = [];

                            let indx = history.indexOf(data.content);
                            if (indx != -1)
                                history.splice(indx, 1);

                            return this.set(data.content.to + "/token/" + ticker + "/history", history);
                        });

                        prms = prms.then(() => {
                            let balance = this.get(data.content.from + "/token/" + ticker);
                            if (!balance)
                                balance = 0;
                            balance += parseFloat(data.content.amount);
                            return this.set(data.content.from + "/token/" + ticker, balance);
                        });
                    }

                    prms = prms.then(() => {
                        let history = this.get("all/" + data.content.to + "/tokens/history");
                        if (!history)
                            history = [];

                        let d = data.content;
                        d.ticker = ticker;

                        let indx = history.indexOf(d);
                        if (indx != -1)
                            history.splice(indx, 1);

                        return this.set("all/" + data.content.to + "/tokens/history", history);
                    });

                }

                return prms;
            })

            return promise;
        }
    }

    return dsIndex;
}
