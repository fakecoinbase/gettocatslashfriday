const dscript = require('orwelldb').datascript;

class wallet {
    constructor(app) {
        let WALLETDB = require('./db')(app);
        this.app = app;
        this.db = new WALLETDB();
    }
    init() {
        this.fee = this.app.cnf('consensus').minfeeperbyte;
        this.getAccount("0");
    }
    createAccount(id, force) {

        if (!this.findAddrByAccount(id) || force) {
            let privateKey, publicKey;
            let data = this.app.crypto.createKeyPair();

            privateKey = data.private;
            publicKey = data.public;

            let addr = this.app.orwell.ADDRESS.generateAddressFromPublicKey(publicKey);
            let obj = { hash: id, added: new Date().getTime() / 1000, address: addr, publicKey: publicKey, privateKey: privateKey };

            this.db.save(obj)
            this.addDataListener(publicKey);
            return obj
        } else
            return this.findAddrByAccount(id);
    }
    haveAccount(id) {
        return !!this.findAddrByAccount(id);
    }
    getAccount(id) {
        let obj = this.findAddrByAccount(id);
        if (!obj)
            obj = this.createAccount(id);

        return obj;
    }
    getAllPublicKeys() {
        let arr = [];
        let list = this.db.getList();
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
    findAddrByAccount(id) {
        let obj = this.db.getCollection().chain().find({ hash: id }).simplesort('added', true).limit(1).data({ removeMeta: true });
        return obj[0] || false;
    }
    findAccountByAddr(addr) {
        let obj = this.db.getCollection().chain().find({ address: addr }).simplesort('added', true).limit(1).data({ removeMeta: true });
        return obj[0];
    }
    findAddress(address) {
        let obj = this.db.getCollection().chain().find({ address: address }).simplesort('added', true).limit(1).data({ removeMeta: true });
        return obj[0];
    }
    getAddressUnspent(addr) {
        let utxo = this.app.orwell.utxo.checkAndUnlock(addr);
        let arr = this.app.orwell.utxo.get("address/" + addr);
        
        if (!arr) {
            arr = [];
        }


        let a = [];
        for (let i in arr) {

            if (!arr[i].spent && !arr[i].spentHash && !arr[i].locked)
                a.push(arr[i]);
        }

        return a;

    }
    getAccountAddresses(id) {
        let obj = this.db.getCollection().chain().find({ hash: id }).simplesort('added', true).data({ removeMeta: true });

        let addr = [];
        for (let i in obj) {
            addr.push(obj[i].address);
        }

        return addr;
    }
    getAccounts() {
        let obj = this.db.getCollection().chain().find({}).simplesort('added', true).data({ removeMeta: true });

        let addr = [];
        for (let i in obj) {
            addr.push({ address: obj[i].address, name: obj[i].hash });
        }

        return addr;
    }
    getBalance(id) {
        let addresses = this.getAccountAddresses(id)
        let unspent = this.getAddressessUnspent(addresses);
        
        let amount = 0;
        for (let i in unspent) {
            amount += unspent[i].amount
        }
        return amount
    }
    getBalanceAddress(address) {
        let arr = this.getAddressUnspent(address), balance = 0;

        for (let i in arr) {
            balance += arr[i].amount;
        }

        return balance;
    }
    getAddressessUnspent(arr) {
        let res = [];
        for (let i in arr) {
            res = res.concat(this.getAddressUnspent(arr[i]));
        }

        return res;
    }
    bestUnspent(unspentList, target) {

        if (!unspentList.length)
            return false;

        let lessers = [], greaters = [];
        for (let i in unspentList) {
            if (unspentList[i].amount > target) {
                greaters.push(unspentList[i]);
            } else
                lessers.push(unspentList[i])
        }

        if (greaters.length > 0) {
            let min = null;
            for (let i in greaters) {

                if (!min || greaters[i].amount < min.amount) {
                    min = greaters[i];
                }

            }

            if (min) {
                let change = min.amount - target;
                return {
                    outs: [min],
                    change: change
                }
            }
        }

        lessers = lessers.sort((a, b) => {
            return b.amount - a.amount;
        });

        let result = []
        let accum = 0
        for (let a in lessers) {
            result.push(lessers[a])
            accum += lessers[a].amount
            if (accum >= target) {
                let change = accum - target
                return {
                    outs: result,
                    change: change
                }
            }
        }
        return false;
    }
    createTransaction(account_id, address_destination, amount, datascript, fee) {
        if (!fee)
            fee = 0;

        let addresses = this.getAccountAddresses(account_id)
        let unspent = this.getAddressessUnspent(addresses);
        let res = this.bestUnspent(unspent, amount + fee);

        if (!res)
            return {
                status: false,
                code: -1,
                error: 'can not send ' + (amount + fee) + ' satoshi to address ' + address_destination + ' not have unspent coins',
            }

        //make tx with out1 - address_destination, address2 - change out to new address of account_id
        let inputs = [], privates = [];
        for (let i in res.outs) {
            let prevout = this.app.orwell.consensus.dataManager.getOut(res.outs[i].tx, res.outs[i].index);
            let addrinfo = this.findAddress(prevout.address);

            if (!addrinfo || !addrinfo.privateKey)
                return {
                    status: false,
                    code: -2,
                    error: 'can not find in wallet.dat info about address  ' + prevout.address,
                    address: prevout.address,
                }

            privates.push(addrinfo.privateKey);

            inputs.push({
                hash: res.outs[i].tx,
                index: res.outs[i].index,
                sequence: 0xffffffff,
                prevAddress: prevout.address,
            })
        }

        let outputs = [];
        outputs.push({
            amount: amount,
            scriptPubKey: this.app.orwell.SCRIPT.addressToScript(address_destination)
        });

        let changeaddress;
        if (this.app.cnf('wallet').changeAddress && fee)//if fee exist its mean we have second round of sending, can create new address.
            changeaddress = this.createAccount(account_id, true);
        else
            changeaddress = this.getAccount(account_id);

        if (!changeaddress.address)
            throw new Error('cant create new address');

        outputs.push({
            amount: res.change,
            scriptPubKey: this.app.orwell.SCRIPT.addressToScript(changeaddress.address)
        });

        let tx = this.app.orwell.TX.createFromRaw(inputs, outputs, privates, 0, this.app.cnf('consensus').txversion, datascript);
        return tx;

    }
    createMultiTransaction(account_id, addr_amount_arr, datascript, fee) {
        if (!fee)
            fee = 0;

        let amount = 0, out_addresses = []
        for (let i in addr_amount_arr) {
            amount += addr_amount_arr[i]
        }

        let addresses = this.getAccountAddresses(account_id)
        let unspent = this.getAddressessUnspent(addresses);
        let res = this.bestUnspent(unspent, amount + fee);

        if (!res)
            return {
                status: false,
                code: -1,
                error: 'can not send ' + (amount + fee) + ' satoshi to address ' + out_addresses.join(", ") + ' not have unspent coins',
            }

        //make tx with out1 - address_destination, address2 - change out to new address of account_id
        let inputs = [], privates = [];
        for (let i in res.outs) {
            let prevout = this.app.orwell.consensus.dataManager.getOut(res.outs[i].tx, res.outs[i].index);
            let addrinfo = this.findAddress(prevout.address);

            if (!addrinfo || !addrinfo.privateKey)
                return {
                    status: false,
                    code: -2,
                    error: 'can not find in wallet.dat info about address  ' + prevout.address,
                    address: prevout.address,
                }

            privates.push(addrinfo.privateKey);

            inputs.push({
                hash: res.outs[i].tx,
                index: res.outs[i].index,
                sequence: 0xffffffff,
                prevAddress: prevout.address,
            })
        }

        let outputs = [];
        for (let i in addr_amount_arr) {
            outputs.push({
                amount: addr_amount_arr[i],
                scriptPubKey: this.app.orwell.SCRIPT.addressToScript(i)
            })
        }

        let changeaddress;
        if (this.app.cnf('wallet').changeAddress && fee)//if fee exist its mean we have second round of sending, can create new address.
            changeaddress = this.createAccount(account_id, true);
        else
            changeaddress = this.getAccount(account_id);

        if (!changeaddress.address)
            throw new Error('cant create new address');

        outputs.push({
            amount: res.change,
            scriptPubKey: this.app.orwell.SCRIPT.addressToScript(changeaddress.address)
        })

        let tx = this.app.orwell.TX.createFromRaw(inputs, outputs, privates, 0, this.app.cnf('consensus').txversion, datascript);
        return tx;

    }
    createTransactionFromAddress(address, address_destination, amount, datascript, fee) {
        if (!fee)
            fee = 0;

        let unspent = this.getAddressUnspent(address);
        let res = this.bestUnspent(unspent, amount + fee);

        if (!res)
            return {
                status: false,
                code: -1,
                error: 'can not send ' + (amount + fee) + ' satoshi to address ' + address_destination + ' not have unspent coins',
            }

        //make tx with out1 - address_destination, address2 - change out to new address of account_id
        let inputs = [], privates = [];
        for (let i in res.outs) {
            let prevout = this.app.orwell.consensus.dataManager.getOut(res.outs[i].tx, res.outs[i].index);
            let addrinfo = this.findAddress(prevout.address);

            if (!addrinfo || !addrinfo.privateKey)
                return {
                    status: false,
                    code: -2,
                    error: 'can not find in wallet.dat info about address  ' + prevout.address,
                    address: prevout.address,
                }

            privates.push(addrinfo.privateKey);

            inputs.push({
                hash: res.outs[i].tx,
                index: res.outs[i].index,
                sequence: 0xffffffff,
                prevAddress: prevout.address,
            })
        }

        let outputs = [];
        outputs.push({
            amount: amount,
            scriptPubKey: this.app.orwell.SCRIPT.addressToScript(address_destination)
        })

        let changeaddress = this.findAccountByAddr(address);//change addressess is not working for datascript transactions

        if (!changeaddress.address)
            throw new Error('cant create new address');

        outputs.push({
            amount: res.change,
            scriptPubKey: this.app.orwell.SCRIPT.addressToScript(changeaddress.address)
        })

        let tx = this.app.orwell.TX.createFromRaw(inputs, outputs, privates, 0, this.app.cnf('consensus').txversion, datascript);
        return tx;

    }
    createMultiTransactionFromAddress(addressfrom, addr_amount_arr, datascript, fee) {
        if (!fee)
            fee = 0;

        let amount = 0, addresses = [];
        for (let i in addr_amount_arr) {
            addresses.push(i);
            amount += addr_amount_arr[i]
        }

        let unspent = this.getAddressUnspent(addressfrom);
        let res = this.bestUnspent(unspent, amount + fee);

        if (!res)
            return {
                status: false,
                code: -1,
                error: 'can not send ' + (amount + fee) + ' satoshi to addressess ' + addresses.join(", ") + ' not have unspent coins',
            }



        //make tx with out1 - address_destination, address2 - change out to new address of account_id
        let inputs = [], privates = [];
        for (let i in res.outs) {
            let prevout = this.app.orwell.consensus.dataManager.getOut(res.outs[i].tx, res.outs[i].index);
            let addrinfo = this.findAddress(prevout.address);

            if (!addrinfo || !addrinfo.privateKey)
                return {
                    status: false,
                    code: -2,
                    error: 'can not find in wallet.dat info about address  ' + prevout.address,
                    address: prevout.address,
                }

            privates.push(addrinfo.privateKey);

            inputs.push({
                hash: res.outs[i].tx,
                index: res.outs[i].index,
                sequence: 0xffffffff,
                prevAddress: prevout.address,
            })
        }

        let outputs = [];
        for (let i in addr_amount_arr) {
            outputs.push({
                amount: addr_amount_arr[i],
                scriptPubKey: this.app.orwell.SCRIPT.addressToScript(i)
            })
        }

        let changeaddress = this.findAccountByAddr(addressfrom);//change addressess is not working for datascript transactions

        if (!changeaddress.address)
            throw new Error('cant create new address');

        outputs.push({
            amount: res.change,
            scriptPubKey: this.app.orwell.SCRIPT.addressToScript(changeaddress.address)
        })

        let tx = this.app.orwell.TX.createFromRaw(inputs, outputs, privates, 0, this.app.cnf('consensus').txversion, datascript);
        return tx;

    }
    setFee(amount) {
        this.fee = amount;
    }
    calculateFee(tx) {
        let bytes = new Buffer(tx.toHex(), 'hex').length + 10;//10 bytes just because second tx in bytes can be bigger than first on 1-2 byte. Need that second tx be bigger fee, because it can be not validated
        let operationFee = 0;

        let data = tx.toJSON();
        if (data.datascript) {
            let scripts = data.datascript;
            for (let i in scripts) {
                let d = new dscript(scripts[i]);
                let f = d.toJSON();
                operationFee += this.app.cnf('wallet').operationfee[f.operator];
            }
        }

        return bytes * this.fee + operationFee;
    }
    sendFromAddress(addr, address_destination, amount, datascript) {
        let tx = this.createTransactionFromAddress(addr, address_destination, amount, datascript, amount * 0.01);
        if (tx.status == false)
            return tx;

        //create transaction with new amount (with fee)
        let fee = this.calculateFee(tx);
        tx = this.createTransactionFromAddress(addr, address_destination, amount, datascript, fee);

        if (tx.status == false)
            return tx;

        let hash;
        if (tx.isValid()) {
            hash = tx.send();
            this.makesUnspentLocked(tx);
        } else {
            return {
                status: false,
                code: 'notvalid',
                errors: tx.getLastErrorCodes()
            }
        }

        return {
            fee: fee,
            status: true,
            code: 1,
            hash: hash,
            tx: tx
        }
    }
    send(account_id, address_destination, amount, datascript) {
        let tx = this.createTransaction(account_id, address_destination, amount, datascript, 0);

        if (tx.status == false)
            return tx;

        //create transaction with new amount (with fee) 
        let fee = this.calculateFee(tx);
        tx = this.createTransaction(account_id, address_destination, amount, datascript, fee);

        if (tx.status == false)
            return tx;

        let hash;
        if (tx.isValid()) {
            hash = tx.send();
            this.makesUnspentLocked(tx);
        } else {
            return {
                status: false,
                code: tx.validation_errors.join(", ")
            }
        }

        return {
            fee: fee,
            status: true,
            code: 1,
            hash: hash,
            tx: tx
        }
    }
    sendMulti(account_id, addr_amount_arr, datascript) {
        let tx = this.createMultiTransaction(account_id, addr_amount_arr, datascript, 0);

        if (tx.status == false)
            return tx;

        //create transaction with new amount (with fee)
        let fee = this.calculateFee(tx);
        tx = this.createMultiTransaction(account_id, addr_amount_arr, datascript, fee);

        if (tx.status == false)
            return tx;

        let hash;
        if (tx.isValid()) {
            hash = tx.send();
            this.makesUnspentLocked(tx);
        } else {
            return {
                status: false,
                code: 'notvalid'
            }
        }

        return {
            fee: fee,
            status: true,
            code: 1,
            hash: hash,
            tx: tx
        }

    }
    sendMultiFromAddress(addr, addr_amount_arr, datascript) {
        let tx = this.createMultiTransactionFromAddress(addr, addr_amount_arr, datascript, 0);

        if (tx.status == false)
            return tx;

        //create transaction with new amount (with fee)
        let fee = this.calculateFee(tx);
        tx = null;
        tx = this.createMultiTransactionFromAddress(addr, addr_amount_arr, datascript, fee);

        if (tx.status == false)
            return tx;

        let hash;
        if (tx.isValid()) {
            hash = tx.send();
            this.makesUnspentLocked(tx);
        } else {
            return {
                status: false,
                code: tx.validation_errors.join(', ')
            }
        }

        return {
            fee: fee,
            status: true,
            code: 1,
            hash: hash,
            tx: tx
        }
    }
    makesUnspentLocked(tx) {
        let t = tx.toJSON();
        let changed = 0;
        for (let i in tx['inputs']) {
            let inp = tx['inputs'][i];
            let addrind = this.app.orwell.utxo.get("address/" + inp.prevAddress);
            if (!addrind || !(addrind instanceof Array))
                addrind = [];

            for (let i in addrind) {
                if (addrind[i].tx == inp.hash && addrind[i].index == inp.index) {
                    addrind[i].spentHash = t.hash;
                    addrind[i].spent = 1;
                    addrind[i].locked = 1;
                    changed++;
                    break;
                }
            }

            this.app.orwell.utxo.set("address/" + inp.prevAddress, addrind);
        }

        return changed;
    }
}

module.exports = wallet;
