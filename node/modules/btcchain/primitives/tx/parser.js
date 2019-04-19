/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
let bitPony = require('bitpony');

class txParser {
    constructor(app, hex) {
        this.raw = hex;
        this.app = app;
        this.body = null;
        if (hex)
            this.run();
    }
    static parseScriptSig(app, raw) {
        return app.btcchain.SCRIPT.sigToArray(raw);
    }
    run() {

        if (!this.body) {
            this.body = bitPony.tx.read(this.raw);
        }

        if (this.body['in'][0]['hash'] == '0000000000000000000000000000000000000000000000000000000000000000'
            && this.body['in'][0]['index'] == 0xffffffff)
            this.body.coinbase = 1;

        if (this.body.coinbase) {
            this.body['in'][0]['script'] = this.body['in'][0].scriptSig;
        } else
            for (let i in this.body['in']) {
                this.body['in'][i]['script'] = txParser.parseScriptSig(this.app, this.body['in'][i].scriptSig);
            }

        return this.body;
    }
    getHash() {
        return this.app.tools.reverseBuffer(this.app.btcchain.hash(this.raw)).toString('hex');
    }
    toJSON() {

        let json = this.body;
        let inval = 0, outval = 0;

        //todo: get prev addrout for each input from blockchain storage
        /*for (let i in this.bytesBody['inputs']) {
            let out;
            if (json['in'][i].hash != "0000000000000000000000000000000000000000000000000000000000000000" && global.blockchainInited) {//not a coinbase
                out = blockchain.getOut(json['inputs'][i].tx, json['inputs'][i].index);
                inval += out.value;
            }
        }*/

        for (var i in this.body['out']) {
            this.body['out'][i].address = this.app.btcchain.SCRIPT.scriptToAddr(this.app, this.body.coinbase ? this.body['out'][i].scriptPubKey : this.body['out'][i].script);
            outval += this.body['out'][i].amount;
        }

        json.fee = this.fee = inval / outval;
        json.size = this.size = new Buffer(this.raw).length;
        if (!this.body.hash)
            this.body.hash = json.hash = this.getHash();
        return json;
    }
    fromJSON(json_str) {

        let buff = bitPony.tx.write(
            json_str.version,
            json_str.in,
            json_str.out,
            json_str.lock_time);

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

    static toJSON(app, hex) {
        let tx = new txParser(app, hex);
        return tx.toJSON();
    }
    static fromJSON(app, tx_json) {
        let tx = new txParser(app);
        return tx.fromJSON(tx_json);
    }
    static toHEX(app, tx_json) {
        let tx = new txParser(app);
        return tx.fromJSON(tx_json);
    }
    static fromHEX(app, hex) {
        let tx = new txParser(app, hex);
        tx.toJSON();
        return tx;
    }
}

module.exports = txParser;