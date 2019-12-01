/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

let dscript = require('orwelldb').datascript;
let bitPony = require('bitpony');

module.exports = function (app) {

    class builder {
        constructor() {
            this.app = app;
            this.version = app.cnf('consensus').version;
            this.lock_time = 0;
            this.inputs = [];
            this.outputs = [];
            this.datascripts = [];
            this.signatures = [];
            this.scriptSigRaw = [];
            this.gensigned = 0;
            this.isCoinbase = 0;
            this.coinbaseData = '';
            this.coinbaseAddr = '';
            this.coinbaseAmount = 0;
        }
        setInputs(arr, addresses) {

            if (!addresses)
                addresses = [];
            for (let i in arr) {
                if (!arr[i].hash && arr[i].index != 0xffffffff)
                    throw new Error('field hash is not entered for input of new tx.in[' + i + ']');

                if (arr[i].scriptSig) {
                    this.signatures[i] = arr[i].scriptSig;
                    this.scriptSigRaw[i] = app.orwell.SCRIPT.sigToArray(arr[i].scriptSig);
                }

                if (arr[i].sig) {
                    this.signatures[i] = arr[i].sig;
                    let p = app.orwell.SCRIPT.sigToArray(arr[i].sig);
                    this.scriptSigRaw[i] = [p.der, p.publicKey];
                }

                if (!arr[i].prevAddress && this.scriptSigRaw[i]) {
                    arr[i].prevAddress = app.orwell.ADDRESS.generateAddressFromPublicKey(this.scriptSigRaw[i][1]);
                }

                if (!arr[i].prevAddress && addresses[i]) {
                    arr[i].prevAddress = addresses[i];
                }

                if (!arr[i].prevAddress)
                    throw new Error('field prevAddress is not entered for input of new tx.in[' + i + ']');

                this.inputs[i] = arr[i]//[arr[i].hash, arr[i].index, arr[i].prevAddress || addresses[i], arr[i].sequence];

            }
            return this;
        }
        setOutputs(arr) {
            for (let i in arr) {

                if (arr[i].address) {
                    if (!app.orwell.ADDRESS.isValidAddress(arr[i].address))
                        throw new Error('invalid address field for tx.out[' + i + ']');
                }

                if (arr[i].scriptPubKey || arr[i].script) {
                    let addr;
                    try {
                        addr = app.orwell.SCRIPT.scriptToAddr(arr[i].scriptPubKey || arr[i].script);
                    } catch (e) {
                        if (e.message == 'Invalid hex string')
                            throw new Error('invalid tx.out[' + i + '] scriptSig');
                        else
                            throw e;
                    }

                    if (!app.orwell.ADDRESS.isValidAddress(addr))
                        throw new Error('invalid address field for tx.out[' + i + ']');
                }


                if (!arr[i].scriptPubKey && !arr[i].script && !arr[i].address) {
                    throw new Error('invalid address/script/scriptPubKey (not exist) field for tx.out[' + i + ']');
                }

                this.outputs[i] = arr[i];
            }
            
            return this;
        }
        setVersion(ver) {
            this.version = ver;
            return this;
        }
        setLockTime(lock) {
            this.lock_time = lock;
            return this;
        }
        setSigned(signed_hex) {
            this.signed = signed_hex;
            return this;
        }
        setCoinbase(inp, out) {
            throw new Error('Coinbase transactions is deprecated');
            this.isCoinbase = 1;
            this.coinBaseData = inp.scriptSig;

            if (!this.coinBaseData)
                throw new Error('coinbase scriptSig (data) must exist');

            this.coinBaseSequence = typeof inp.sequence == 'undefined' ? 0 : inp.sequence;
            this.coinbaseOuts = [];

            for (let i in out) {
                if (out[i].address) {
                    if (!app.orwell.ADDRESS.isValidAddress(out[i].address))
                        throw new Error('invalid address field for tx.out[' + i + ']');

                    out[i].scriptPubKey = app.orwell.SCRIPT.addressToScript(out[i].address);
                }

                if (out[i].scriptPubKey) {
                    let addr;
                    try {
                        addr = app.orwell.SCRIPT.scriptToAddr(out[i].scriptPubKey);
                        out[i].address = addr;
                    } catch (e) {
                        if (e.message == 'Invalid hex string')
                            throw new Error('invalid tx.out[' + i + '] scriptSig');
                        else
                            throw e;
                    }
                    if (!app.orwell.ADDRESS.isValidAddress(addr))
                        throw new Error('invalid address field for tx.out[' + i + ']');
                }

                if (!out[i].scriptPubKey && !out[i].address) {
                    throw new Error('invalid address/scriptPubKey (not exist) field for tx.out[' + i + ']');
                }

                this.coinbaseOuts[i] = out[i];
            }

            return this;
        }
        attachData(data, pem) {
            if (this.isCoinbase)
                throw new Error('cant attach datascript into coinbase transaction');
            //may thrown error
            this.datascripts.push(new dscript(data, pem));
            return this;
        }
        setDatascript(script) {
            //may thrown error
            this.datascripts = script;
            return this;
        }
        generate() {

            let write = new bitPony.writer(new Buffer(""));
            write.uint32(this.version, true);
            write.var_int(this.inputs.length, true);
            for (let i in this.inputs) {
                let inp = this.inputs[i],
                    index = inp.index,
                    txhash = (!inp.hash && index == 0xffffffff) ? "0000000000000000000000000000000000000000000000000000000000000000" : inp.hash,
                    addr = inp.prevAddress,
                    sec = inp.sequence || inp.seq || 0xffffffff, sgs;

                if (this.signatures[i] == -1)
                    sgs = "";
                else if (this.signatures[i] === 1) {
                    sgs = app.orwell.SCRIPT.addressToScript(addr);
                } else
                    sgs = this.signatures[i];

                write.tx_in(txhash, index, sgs, sec, true);
            }

            write.var_int(this.outputs.length, true);
            for (let o in this.outputs) {
                let s = this.outputs[o],
                    addr = s.scriptPubKey || s.script,
                    amount = s.amount,
                    frm = 1;
                if (s.address) {
                    frm = 0;
                    addr = s.address;
                }

                let sigo = (frm === 1 ? addr : app.orwell.SCRIPT.addressToScript(addr));
                write.tx_out(amount, sigo, true);
            }

            write.uint32(this.lock_time, true);

            let dsc = "";
            if (!this.inputs[0].hash && this.inputs[0].index == 0xffffffff && this.inputs[0].coinbase) {
                //attach coinbase Bytes as datascript
                dsc = "cbae" + new Buffer(this.inputs[0].coinbase, 'hex').toString('hex');
            } else {
                if (this.datascripts instanceof Array && this.datascripts.length > 0) {
                    let scriptslist = [];
                    for (let i in this.datascripts) {
                        if (this.datascripts[i] instanceof dscript)
                            scriptslist.push(this.datascripts[i].toHEX());
                        else
                            scriptslist.push(this.datascripts[i]);
                    }
                    dsc = dscript.writeArray(scriptslist);
                } else
                    dsc = this.datascripts;
            }

            this[this.gensigned ? 'signed' : 'rawunsigned'] = write.getBuffer().toString('hex') + "" + dsc;
        }
        sign(private_keys) {
            let siglist = [];

            if (!private_keys || (!private_keys instanceof Array) || private_keys.length != this.inputs.length)
                throw new Error('Invalid keystore length, must be >=' + this.inputs.length + ' keys');

            this.gensigned = 0;
            for (let i in this.inputs) {
                this.signatures[i] = -1;
            }

            for (let i in this.inputs) {
                this.signatures[i] = 1;
                this.generate();

                let tx = this.rawunsigned + "01000000",
                    txb = new Buffer(tx, 'hex'),
                    sig256 = app.orwell.hash(txb),
                    sig = app.crypto.sign(new Buffer(private_keys[i], 'hex'), sig256),
                    scriptSig = app.orwell.SCRIPT.scriptSig(sig, new Buffer(app.crypto.getPublicByPrivate(private_keys[i]), 'hex'));

                this.scriptSigRaw[i] = [
                    sig.toString('hex'),
                    app.crypto.getPublicByPrivate(private_keys[i])
                ];

                this.signatures[i] = -1;
                siglist[i] = scriptSig;
            }

            this.signatures = siglist;
            this.gensigned = 1;
            this.generate();

            return this;
        }
        isRaw(israw) {
            if (!israw) {
                this.gensigned = 1;
            }
            return this;
        }
        verify() {
            let res = [];
            for (let i in this.inputs) {
                let pubkey = this.scriptSigRaw[i][1];
                let sign = this.scriptSigRaw[i][0];
                let signable = this.getSignableTransaction(i, this.inputs[i].prevAddress) + "01000000";
                let hash2sign = app.orwell.hash(new Buffer(signable, 'hex'));
                res[i] = app.crypto.verify(pubkey, sign, hash2sign);
            }

            let result = true;
            for (let i in res) {
                if (!res[i])
                    result = false;
            }

            if (!result)
                throw new Error('can not verify signature of transaction');

            return result;
        }
        getSignableTransaction(k, addr) {
            let b = new Buffer(this.signed, 'hex');
            let datascripts = [];
            let read = new bitPony.reader(b);
            let res = read.tx(0);
            let tx = res.result;
            let coinbaseInfo = "";

            if (b[res.offset] == 0xef || b[res.offset] == 0xee) {
                let scripts = dscript.readArray(b.slice(res.offset));
                for (let i in scripts) {
                    datascripts[i] = new dscript(scripts[i]);
                }
            } else if (b[res.offset] == 0xcb && b[res.offset + 1] == 0xae) {//coinbase info
                coinbaseInfo = "cbae" + b.slice(res.offset + 2).toString('hex');
            }

            let write = new bitPony.writer(new Buffer(""));
            write.uint32(tx.version, true);
            write.var_int(tx.in.length, true);

            for (let i in tx.in) {
                let inp = tx.in[i],
                    index = inp.index,
                    txhash = inp.hash, sgs;

                if (i == k)
                    sgs = app.orwell.SCRIPT.addressToScript(addr);
                else
                    sgs = "";

                write.tx_in(txhash, index, sgs, inp.sequence || 0xffffffff, true);
            }

            write.var_int(tx.out.length, true);

            for (let o in tx.out) {
                let s = tx.out[o],
                    sigo = s.scriptPubKey || s.script,
                    amount = s.amount;
                write.tx_out(amount, sigo, true);
            }

            write.uint32(tx.lock_time, true);
            let dsc = "";

            if (datascripts.length > 0) {
                let arr = [];
                for (let i in datascripts) {
                    if (datascripts[i] instanceof dscript)
                        arr.push(datascripts[i].toHEX());
                    else
                        arr.push(datascripts[i]);
                }
                dsc = dscript.writeArray(arr);
            } else if (coinbaseInfo) {
                dsc = coinbaseInfo;
            }

            return write.getBuffer().toString('hex') + dsc;
        }
        getId() {
            return app.tools.reverseBuffer(app.orwell.hash(this.signed)).toString('hex');
        }
        getRaw() {
            return this.rawunsigned;
        }
        getSigned() {
            return this.signed;
        }
        getCoinBase() {
            if (!this.result)
                this.generate();
            return this.result;
        }
    }

    return builder;
}