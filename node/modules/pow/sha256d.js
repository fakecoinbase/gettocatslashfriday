const crypto = require('crypto');

module.exports = function (bufferOrString) {
    return crypto.createHash('sha256').update(crypto.createHash('sha256').update(bufferOrString).digest()).digest();
}
