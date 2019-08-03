/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
let bitPony = require('bitpony');
module.exports = function (app) {
    class txParser {
        constructor(hex) {
            this.raw = hex;
            app = app;
            this.body = null;
            if (hex)
                this.run();
        }
        static parseScriptSig(raw) {
            return app.orwell.SCRIPT.sigToArray(raw);
        }
        run() {

            if (!this.body) {
                this.body = bitPony.tx.read(this.raw);
            }

            if (this.body['in'][0]['hash'] == '0000000000000000000000000000000000000000000000000000000000000000'
                && this.body['in'][0]['index'] == 0xffffffff)
                this.body.coinbase = 1;

            for (let i in this.body['in']) {
                let a = txParser.parseScriptSig(this.body['in'][i].scriptSig);
                this.body['in'][i]['der'] = a.der;
                this.body['in'][i]['publicKey'] = a.publicKey;
            }

            return this.body;
        }
        getHash() {
            return app.tools.reverseBuffer(app.orwell.hash(this.raw)).toString('hex');
        }
        toJSON() {

            let json = this.body;
            let inval = 0, outval = 0;
            let compact_in = [];
            let compact_out = [];

            //todo: get prev addrout for each input from blockchain storage
            for (let i in this.body['in']) {
                let out;
                if (json['in'][i].hash != "0000000000000000000000000000000000000000000000000000000000000000") {//not a coinbase
                    out = app.orwell.getOut(json['in'][i].hash, json['in'][i].index);
                    inval += out.value;
                }

                compact_in.push({
                    hash: json['in'][i].hash,
                    index: json['in'][i].index,
                    sig: json['in'][i].scriptSig,
                    key: json['in'][i].publicKey,
                    seq: json['in'][i].sequence,
                });
            }

            for (var i in this.body['out']) {
                this.body['out'][i].address = app.orwell.SCRIPT.scriptToAddr(this.body.coinbase ? this.body['out'][i].scriptPubKey : this.body['out'][i].script);
                outval += this.body['out'][i].amount;

                compact_out.push({
                    amount: this.body['out'][i].amount,
                    address: this.body['out'][i].address,
                    script: this.body['out'][i].scriptPubKey,
                });
            }

            json.fee = this.fee = inval > 0 ? (inval - outval) : 0;
            json.size = this.size = new Buffer(this.raw).length;
            if (!this.body.hash)
                this.body.hash = json.hash = this.getHash();

            let compact = {
                hash: json.hash,
                version: json.version,
                in: compact_in,
                out: compact_out,
                lock: json.lock_time,
                fee: json.fee,
                size: json.size,
            };

            return compact;
        }
        fromJSON(json_str) {

            for (let i in json_str.in) {
                json_str.in[i].scriptSig = json_str.in[i].sig;
                json_str.in[i].sequence = json_str.in[i].seq;
            }

            for (let o in json_str.out) {
                json_str.out[o].scriptPubKey = json_str.out[o].script;
            }

            let buff = bitPony.tx.write(
                json_str.version,
                json_str.in,
                json_str.out,
                json_str.lock);

            this.size = json_str.size;
            this.fee = json_str.fee;
            this.body = json_str;
            this.raw = buff.toString('hex');
            return this;
        }
        getSize() {
            if (!this.size)
                this.toJSON();
            return this.size;
        }
        getFee() {
            if (!this.fee)
                this.toJSON();
            return this.fee;
        }

        static toJSON(hex) {
            let tx = new txParser(hex);
            return tx.toJSON();
        }
        static fromJSON(tx_json) {
            let tx = new txParser();
            return tx.fromJSON(tx_json);
        }
        static toHEX(tx_json) {
            let tx = new txParser();
            return tx.fromJSON(tx_json);
        }
        static fromHEX(hex) {
            let tx = new txParser(hex);
            tx.toJSON();
            return tx;
        }
    }

    return txParser;
}