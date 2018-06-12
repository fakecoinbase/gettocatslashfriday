const cr = require('crypto');
let pow = require('../node/modules/pow/index');
let hash = function (data) {
    return cr.createHash('sha256').update(data).digest();
}

let reverseBuffer = function (buff) {
    buff = new Buffer(buff, 'hex');
    var out_rev = Buffer.alloc(buff.length), i = 0
    for (; i < buff.length; i++) {
        out_rev[buff.length - 1 - i] = buff[i];
    }

    return out_rev;
}


let i = 1;
while (i++) {
    if (pow.checkHash(hash(i + "").toString('hex'), 10e6)===true) {
        console.log("catched! i", i, hash(i + "").toString('hex'), pow.checkHash(hash(i + "").toString('hex'), 10e6));
        break;
    }
}

