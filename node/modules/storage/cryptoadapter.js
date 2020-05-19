
const fs = require('fs');
const crypto = require('crypto');

class cryptoAdapter {

    constructor(secret) {
        this.CIPHER = 'aes-256-cbc';
        this.KEY_DERIVATION = 'pbkdf2';
        this.KEY_LENGTH = 256;
        this.ITERATIONS = 64000;
        this.secret = secret;
    }
    encrypt(input, secret) {
        if (!secret) {
            throw new Error('A \'secret\' is required to encrypt');
        }

        let salt = crypto.randomBytes(this.KEY_LENGTH / 8),
            iv = crypto.randomBytes(16);

        try {

            let key = crypto.pbkdf2Sync(secret, salt, this.ITERATIONS, this.KEY_LENGTH / 8),
                cipher = crypto.createCipheriv(this.CIPHER, key, iv);

            let encryptedValue = cipher.update(input, 'utf8', 'hex');
            encryptedValue += cipher.final('hex');

            return {
                cipher: this.CIPHER,
                keyDerivation: this.KEY_DERIVATION,
                keyLength: this.KEY_LENGTH,
                iterations: this.ITERATIONS,
                iv: iv.toString('hex'),
                salt: salt.toString('hex'),
                value: encryptedValue
            };

        } catch (err) {
            throw new Error('Unable to encrypt value due to: ' + err);
        }
    }


    decrypt(input, secret) {
        // Ensure we have something to decrypt
        if (!input) {
            throw new Error('You must provide a value to decrypt');
        }
        // Ensure we have the secret used to encrypt this value
        if (!secret) {
            throw new Error('A \'secret\' is required to decrypt');
        }

        // If we get a string as input, turn it into an object
        if (typeof input !== 'object') {
            try {
                input = JSON.parse(input);
            } catch (err) {
                throw new Error('Unable to parse string input as JSON');
            }
        }

        // Ensure our input is a valid object with 'iv', 'salt', and 'value'
        if (!input.iv || !input.salt || !input.value) {
            throw new Error('Input must be a valid object with \'iv\', \'salt\', and \'value\' properties');
        }

        let salt = new Buffer(input.salt, 'hex'),
            iv = new Buffer(input.iv, 'hex'),
            keyLength = input.keyLength;
        iterations = input.iterations;

        try {

            let key = crypto.pbkdf2Sync(secret, salt, iterations, keyLength / 8),
                decipher = crypto.createDecipheriv(this.CIPHER, key, iv);

            let decryptedValue = decipher.update(input.value, 'hex', 'utf8');
            decryptedValue += decipher.final('utf8');

            return decryptedValue;

        } catch (err) {
            throw new Error('Unable to decrypt value due to: ' + err);
        }
    }

    setSecret(secret) {
        this.secret = secret;
    }

    loadDatabase(dbname, callback) {
        let decrypted;
        let secret = this.secret;

        fs.exists(dbname, (exists) => {
            if (exists) {
                let encrypted = fs.readFileSync(dbname, 'utf8');
                if (secret) {
                    decrypted = this.decrypt(encrypted, secret);
                } else {//unecrypted

                    let v = JSON.parse(encrypted);
                    if (v.salt && v.iv) {
                        throw new Error('Can not decrypt database, have encryption but secret is not present');
                    }

                    decrypted = encrypted;
                }
            }

            callback(decrypted);
        });
    }
    saveDatabase(dbname, dbstring, callback) {
        let encrypted;
        if (this.secret)
            encrypted = this.encrypt(dbstring, this.secret);
        else
            encrypted = dbstring;//do not encrypt

        fs.writeFileSync(dbname,
            JSON.stringify(encrypted, null, '  '),
            'utf8');
        if (typeof (callback) === 'function') {
            callback();
        }
    }


}

module.exports = cryptoAdapter;