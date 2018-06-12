const cryptonight = require('node-cryptonight').hash;

module.exports = function (bufferOrString) {
    return cryptonight(Buffer.from(bufferOrString), 1);
}
