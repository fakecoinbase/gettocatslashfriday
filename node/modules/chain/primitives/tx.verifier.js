const bitPony = require('bitpony');

class Verifier {

    constructor(app, tx) {
        this.app = app;
        this.data = tx;
        
        if (!this.data)
            throw new Error('Txdata is required for tx');

        this.verified = null;
        this.verify();
    }
    verify() {

        let stream_check = new bitPony.writer();
        stream_check.uint32(this.data.timestamp, true);
        stream_check.string(this.data.key, true);
        stream_check.string("", true);
        stream_check.string(this.data.data, true);

        return this.verified = this.app.crypto.verify(this.data.key, this.data.sign, stream_check.getBuffer());
    }
    isVerified(){
        return this.verified;
    }
}

module.exports = Verifier;