const crypto = require('crypto');
const hash = require('hash.js');
const base58 = require('base-58');

module.exports = (app) => {

    class address {

        static sha256(message, output) {
            if (!output)
                output = '';
            return crypto.createHash('sha256').update(message).digest(output);
        }
        static ripemd160(message, output) {
            if (!output)
                output = '';
            return hash.ripemd160().update(message).digest(output)
        }
        //private WIF
        static createPrivateWIF(priv) {
            let privateKeyAndVersion = "80" + priv.toUpperCase();
            let firstSHA = address.sha256(new Buffer(privateKeyAndVersion, 'hex'))
            let secondSHA = address.sha256(firstSHA, 'hex')
            let checksum = secondSHA.substr(0, 8).toUpperCase()
            let keyWithChecksum = new Buffer(privateKeyAndVersion + checksum, 'hex');
            let privateKeyWIF = base58.encode(keyWithChecksum)
            return privateKeyWIF;
        }
        static getPrivateKeyFromWIF(wif) {
            var key = new Buffer(base58.decode(wif));
            var buff = Buffer.alloc(key.length - 5);
            for (var i = 0, k = 0; i < key.length; i++) {
                if (i == 0)
                    continue;
                if (key.length - i <= 4)
                    continue;

                buff[k++] = key[i];
            }
            return buff
        }
        //address
        static createAddressHashFromPublicKey(pubkeyBuffOrHex) {
            return address.ripemd160(address.sha256(new Buffer(pubkeyBuffOrHex, 'hex')), 'hex');
        }
        static generateAddressFromPublicKey(pubkeyBuffOrHex) {
            let byte = Number(address.FIRSTBYTE).toString(16);
            if (byte.length < 2)
                byte = "0" + byte;
            let key = byte + address.createAddressHashFromPublicKey(pubkeyBuffOrHex);
            let f = address.sha256(address.sha256(new Buffer(key, 'hex')));

            let a = [];
            let buffer = f;
            for (let i = 0; i < 4; i++) {
                a.push(buffer[i]);
            }

            let dig = new Buffer(a).toString('hex');
            let res = key + dig;

            return base58.encode(new Buffer(res, 'hex'));
        }
        static generateAddressFromAddrHash(hash) {

            let byte = Number(address.FIRSTBYTE).toString(16);
            if (byte.length < 2)
                byte = "0" + byte;
            var key = byte + hash;
            var f = address.sha256(address.sha256(new Buffer(key, 'hex')));

            var a = [];
            var buffer = f;
            for (var i = 0; i < 4; i++) {
                a.push(buffer[i]);
            }

            var dig = new Buffer(a).toString('hex');
            var res = key + dig;

            return base58.encode(new Buffer(res, 'hex'));
        }
        static getPublicKeyHashByAddress(addr) {
            var key = new Buffer(base58.decode(addr));
            var buff = Buffer.alloc(20);
            for (var i = 0, k = 0; i < key.length; i++) {
                if (i == 0)
                    continue;
                if (key.length - i <= 4)
                    continue;

                buff[k++] = key[i];
            }

            return buff;
        }
        //tests
        static isValidAddress(address_) {

            if (!address_)
                return false;

            if (address_.length <= 0)
                return false;

            let buff = base58.decode(address_);
            let dig = [];
            for (let i = buff.length - 1, k = 0; k < 4; k++ , i--) {
                dig[3 - k] = (buff[i]);
            }


            let dig_hex = new Buffer(dig).toString('hex');
            let key = Buffer.alloc(buff.length - 4);
            for (let i = 0; i < buff.length; i++) {
                if (i <= buff.length - 5)
                    key[i] = buff[i];
            }

            let f = address.sha256(address.sha256(key));
            let a = [];
            let buffer = f;
            for (let i = 0; i < 4; i++) {
                a.push(buffer[i]);
            }

            let dig_f = new Buffer(a).toString('hex');
            return dig_f === dig_hex;

        }
        static isValidDomain(domain) {
            let r = /^([0-9a-z\.]{3,255})$/gi,
                r_dots = /\.{2,}/gi,//more then one dots one by one
                r_dotsfl = domain[0] != '.' && domain[domain.length - 1] != '.';

            return r_dotsfl && !r_dots.test(domain) && r.test(domain)

        }
    }

    address.FIRSTBYTE = '115';//115

    return address;
}