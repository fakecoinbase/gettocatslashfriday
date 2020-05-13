const ecdsacsr = require('ecdsa-csr');
const EC = require('elliptic').ec;
let keys = require('key-encoder').default;
let keyEncoder = new keys({
    curveParameters: [1, 3, 132, 0, 10],
    privatePEMOptions: { label: 'EC PRIVATE KEY' },
    publicPEMOptions: { label: 'PUBLIC KEY' },
    curve: new EC('secp256k1')
});

console.log(keyEncoder.encodePrivate('7b3ac584a28612d2731ae918d4e66af1ff6d0ce7aced8d54d81ba20b09113b0d', 'raw', 'pem'));
ecdsacsr({ key: keyEncoder.encodePrivate('7b3ac584a28612d2731ae918d4e66af1ff6d0ce7aced8d54d81ba20b09113b0d', 'raw', 'pem'), domains: ['test.ru'] }).then(function (csr) {
    console.log('CSR PEM:');
    console.log(csr);
});