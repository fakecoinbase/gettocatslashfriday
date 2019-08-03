/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
module.exports = (app) => {

    class script {
        constructor(stack) {
            this.buffer = new Buffer(stack, 'hex');
            this.stack = stack;
            this.buffer = null;
            this.result = "";
        }

        makeFromStack() {
            let res = "";
            for (let i in this.stack) {

                if (this.stack[i] instanceof Array) {
                    let func = this.stack[i].shift();
                    res += script.op[func].apply(this, this.stack[i]);
                } else {
                    res += script.op[this.stack[i]];
                }

            }

            return this.result = res;
        }
        create() {
            if (!this.result)
                this.makeFromStack();
            return this.result;
        }
        static addressToScript(addr) {
            return new script([
                'OP_DUP',
                'OP_HASH160',
                ['PUSHDATA', app.orwell.ADDRESS.getPublicKeyHashByAddress(addr), 14],
                'OP_EQUALVERIFY',
                'OP_CHECKSIG'
            ]).create();
        }
        static isP2PKH(buffer) {
            let res = true;
            for (let i = 0; i < buffer.length; i++) {
                if (i == 0)
                    res = (app.tools.numHex(buffer[i]) == script.op['OP_DUP']);
                if (i == 1)
                    res = (app.tools.numHex(buffer[i]) == script.op['OP_HASH160']);
                if (i == 2)
                    res = (app.tools.numHex(buffer[i]) == 14);
                if (i == 23)
                    res = (app.tools.numHex(buffer[i]) == script.op['OP_EQUALVERIFY']);
                if (i == 24)
                    res = (app.tools.numHex(buffer[i]) == script.op['OP_CHECKSIG']);
            }
            return res;
        }
        static addrHashToScript(buffer) {
            return new script([
                'OP_DUP',
                'OP_HASH160',
                ['PUSHDATA', buffer, 14],
                'OP_EQUALVERIFY',
                'OP_CHECKSIG'
            ]).create();
        }
        static scriptToAddrHash(scriptBuffer) {
            let adr = new addressParser(scriptBuffer);
            return adr.getBytes('addr');
        }
        static scriptToAddr(scriptBuffer) {
            let adrhash = script.scriptToAddrHash(scriptBuffer);
            return app.orwell.ADDRESS.generateAddressFromAddrHash(adrhash.toString('hex'));
        }
        static scriptSig(der, pubkey) {
            return new script([
                ['PUSHDATA', der, 47],
                'SIGHASH_ALL',
                ['PUSHDATA', pubkey, 41]
            ]).create();
        }
        static sigToArray(sc) {
            var res = script.parseScriptSig(sc);
            var der = Buffer.concat([
                new Buffer(res['seq']),
                new Buffer(res['derlen']),
                new Buffer(res['intX']),
                new Buffer(res['derXlen']),
                new Buffer(res['derX']),
                new Buffer(res['intY']),
                new Buffer(res['derYlen']),
                new Buffer(res['derY']),
            ]).toString('hex');

            var pub = Buffer.concat([
                new Buffer(res['pubtype']),
                new Buffer(res['pubkeyX']),
                new Buffer(res['pubkeyY']),
            ]).toString('hex');
            return { der: der, publicKey: pub };
        }
        static parseScriptSig(raw) {
            //todo: multisig
            if (!raw)
                return {};

            raw = new Buffer(raw, 'hex');
            let arr = {
                0: 'pushdata47',
                1: 'seq',
                2: 'derlen',
                3: 'intX',
                4: 'derXlen'
            };
            let sel = '', out = {};
            for (let i = 0; i < raw.length; i++) {
                if (arr[i])
                    sel = arr[i];
                if (arr[i] == 'derXlen') {
                    arr[i + 1] = 'derX';
                    arr[i + raw[i] + 1] = 'intY';
                    arr[i + raw[i] + 2] = 'derYlen';
                }
                if (arr[i] == 'derYlen') {
                    arr[i + 1] = 'derY';
                    arr[i + raw[i] + 1] = 'sighash_all';
                }
                if (arr[i] == 'sighash_all') {
                    arr[i + 1] = 'pushdata41';
                }
                if (arr[i] == 'pushdata41') {
                    arr[i + 1] = 'pubtype';
                }
                if (arr[i] == 'pubtype') {
                    arr[i + 1] = 'pubkeyX';
                    let len;
                    
                    if (raw[i] == 3 || raw[i] == 2)//compressed, https://davidederosa.com/basic-blockchain-programming/elliptic-curve-keys/
                        len = 32;
                    else
                        len = 64;

                    arr[i + 1 + len / 2] = 'pubkeyY';
                }
                if (!out[sel])
                    out[sel] = [];
                out[sel].push(raw[i]);
            }
            return out;
        }
    }

    script.op = {
        'OP_DUP': '76',
        'OP_HASH160': 'a9',
        'PUSHDATA': function (data, len) {
            let hex = new Buffer(data).toString('hex');
            return (len ? len : data.length) + hex
        },
        'OP_EQUALVERIFY': '88',
        'OP_CHECKSIG': 'ac',
        'SIGHASH_ALL': '01',
    }


    class addressParser {
        constructor(hex) {
            this.bytesBody = [];
            this.prettyBody = [];

            this.raw = new Buffer(hex, 'hex');
            this.run();
        }
        run() {
            if (!this.prettyBody.length) {
                this.parseBytes();
                return this.prettify();
            } else
                return this.prettyBody;
        }
        parseBytes() {
            let arr = {
                0: 'OP_DUP',
                1: 'OP_HASH160',
                2: 'PUSHDATA14',
                3: 'addr',
                23: 'OP_EQUALVERIFY',
                24: 'OP_CHECKSIG',
            }, sel = '', out = {};

            for (let i = 0; i < this.raw.length; i++) {
                if (arr[i])
                    sel = arr[i];

                if (!out[sel])
                    out[sel] = [];
                out[sel].push(this.raw[i]);
            }

            this.bytesBody = out;
        }
        prettify() {
            let buffs = [];
            for (let i in this.bytesBody) {
                buffs[i] = new Buffer(this.bytesBody[i]).toString('hex');
            }

            this.prettyBody = buffs;
            return buffs;
        }
        getBytes(name) {
            return new Buffer(this.bytesBody[name]);
        }
        getString(name) {
            return this.prettyBody[name];
        }
    }

    script.addressParser = addressParser;

    return script;
}