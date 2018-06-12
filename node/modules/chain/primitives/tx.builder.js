const bitPony = require('bitpony');

class Builder {

    constructor(app, txdata, keystore, type) {

        if (type == 'hash') {
            this.app = app;
            this.data = txdata;
            this.type = type ? type : 'common';
            this.signed = null;
            this.verified = null;
            this.buildHash();
        } else {
            this.timestamp = parseInt(new Date().getTime() / 1000);
            if (type == 'coinbase')
                this.timestamp = 0;
            this.app = app;
            this.data = txdata;
            this.keystore = keystore;
            this.type = type ? type : 'common';

            if (!this.data)
                throw new Error('Additional txdata is required for tx');

            if (!this.keystore && !this.keystore.privateKey)
                throw new Error('Private key is required for building tx');

            this.signature = null;
            this.raw = null;
            this.signed = null;
            this.verified = null;

            this.createRaw();
            this.sign();
            this.createSigned();
            this.verify();
        }

    }
    createRaw() {
        let stream = new bitPony.writer();
        stream.uint32(this.timestamp, true);
        stream.string(this.keystore.publicKey, true);
        stream.string("", true);
        stream.string(this.data, true);

        return this.raw = stream.getBuffer()
    }
    sign() {
        return this.signature = this.app.crypto.sign(this.keystore.privateKey, this.raw);
    }
    createSigned() {
        let stream = new bitPony.writer();
        stream.uint32(this.timestamp, true);
        stream.string(new Buffer(this.keystore.publicKey, 'hex'), true);
        stream.string(this.signature, true);
        stream.string(this.data, true);

        return this.signed = stream.getBuffer()
    }
    verify() {

        let stream = new bitPony.reader(this.signed);

        let result = [];
        let res = stream.uint32(0);
        result.push(res.result);
        res = stream.string(res.offset);
        result.push(res.result.toString('hex'));
        res = stream.string(res.offset);
        result.push(res.result.toString('hex'));
        res = stream.string(res.offset);
        result.push(res.result);

        let stream_check = new bitPony.writer();
        stream_check.uint32(result[0], true);
        stream_check.string(result[1], true);
        stream_check.string("", true);
        stream_check.string(result[3], true);

        return this.verified = this.app.crypto.verify(result[1], result[2], stream_check.getBuffer());
    }
    buildHash() {
        let stream = new bitPony.writer();
        stream.uint32(this.data.timestamp, true);
        stream.string(new Buffer(this.data.key, 'hex'), true);
        stream.string(new Buffer(this.data.signature, 'hex'), true);
        stream.string(this.data.data, true);

        this.verified = true;
        return this.signed = stream.getBuffer()
    }
    getBuffer() {

        if (!this.signed)
            throw new Error('Dont have signed data');

        if (!this.verified)
            throw new Error('Transaction is not verified successfully');

        return this.signed;

    }
    getTimestamp() {
        return this.timestamp;
    }
    getKey() {
        return this.keystore.publicKey
    }
    getSign() {
        return this.signature.toString('hex')
    }
    getData() {
        return this.data
    }
    getHex() {
        return this.getBuffer().toString('hex');
    }
}

module.exports = Builder;