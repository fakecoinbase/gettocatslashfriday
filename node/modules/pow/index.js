const { U64 } = require('n64');
const BN = require('bn.js');

class pow {
    constructor(app) {
        this.BN = BN;
        this.f_onFind = this.f_onIteration = function () { };
        this.app = app;
        this.interuppted = 0;
        this.hash = require("./" + app.cnf("pow").algo);
    }
    init() {
    }
    setOnIteration(cb) {
        //onIteration idea: build block, return {buffer:'buffer of new blockheader', difficulty: 'searching difficulty for hash'}, param - 
        this.f_onIteration = cb;
    }
    setInterruption(flag) {
        this.interuppted = flag;
    }
    startDig(cb) {
        this.f_onFind = cb;

        let nonce = 0;
        while (nonce < 0xffffffff) {

            let { buffer, difficulty } = this.f_onIteration.apply(this, [nonce]);
            let hashResult = this.hash(buffer);
            if (pow.checkHash(hashResult, difficulty) || this.interuppted) {
                if (!this.interuppted)
                    this.f_onFind.apply(this, [nonce]);
                this.stopDig();
                break;
            }

            nonce++;
        }
    }
    stopDig() {
        this.interuppted = 0;
        this.f_onFind = function () { };
    }
    next_diff(timestamps, difficulties, target_seconds) {
        return pow.next_difficulty(this.app, timestamps, difficulties, target_seconds)
    }
    lt(hash, diff){
        return pow.checkHash(hash, diff)
    }
}

pow.parts = function (bits) {
    var exp = bits >> 32,
        mant = bits & 0xffffffff;
    return [exp, mant];
}

pow.mul = function (a, b) {

    let res = U64(a).mul(U64(b))
    return {
        low: res.lo,
        high: res.hi
    }
}


pow.next_difficulty = function (app, timestamps, difficulties, target_seconds) {
    if (timestamps.length <= 1) {
        return 1;
    }


    if (timestamps.length != difficulties.length)
        throw new Error('invalid difficulty calculation');

    let { diffWindow, diffLag, diffCut } = app.cnf('pow');

    if (difficulties.length < diffWindow)
        diffWindow = difficulties.length;//case 1
    else if (difficulties.length >= diffWindow && difficulties.length < diffWindow + diffLag)
        diffWindow -= diffLag;


    let cut_end = timestamps.length;
    let cut_start = 1;//dont use 1st block values. 

    let N = difficulties.length;
    let L = diffWindow - 2 * diffCut;

    if (N > L && L > 0) {
        let cut_start1 = cut_start + Math.ceil((N + 2 * diffCut - diffWindow) / 2);
        let cut_end1 = cut_end - Math.floor((N + 2 * diffCut - diffWindow) / 2);
        if (cut_start1 != cut_end1 && cut_start1 != cut_end1 - 1) {
            cut_start = cut_start1;
            cut_end = cut_end1;
        }
    }

    let time_span = timestamps[cut_end - 1] - timestamps[cut_start];

    if (time_span <= 0)
        time_span = 1;

    //value TotalT is computed as the difference
    //between the timestamps of the last and the first blocks and the value  
    //If the value of TotalT is not positive, it is assumed to be 1.  

    //TotalD is computed as the sum of the difficulty values of all blocks
    //except the first(the first block is excluded because it was mined
    //before the time indicated by its timestamp, so the time it took to
    //mine it is not included in TotalT).

    let total_work = 0;
    for (let i = cut_start; i <= cut_end - 1; i++) {
        total_work += parseInt(difficulties[i]);
    }

    if (N < 3)
        total_work = 1;

    if (total_work <= 0)
        throw new Error('invalid difficulty work calculation, invalid input vectors');

    let res2 = new BN(total_work).mul(new BN(target_seconds))/*pow.mul(total_work, target_seconds);
    if (res.high != 0 || res.low + time_span - 1 < res.low) {
        return 0;
    }*/

    //console.log(total_work, target_seconds, res2);
    //console.log(difficulties, timestamps, total_work, time_span, cut_start, cut_end, res);

    //better, then cryptonote difficulty adjustment standart
    /*console.log({
        difficulties: difficulties,
        total_work: total_work,
        time_span: time_span,
        total_work_mul_60: res2,
        result: res2.add(new BN(time_span)).sub(new BN(1)).div(new BN(time_span)).toString()
    })*/
    return res2.add(new BN(time_span)).sub(new BN(1)).div(new BN(time_span)).toString();
    //return parseInt((res2 + time_span - 1) / time_span);
}

pow.checkHash = function (hash, diff) {
    let uint128 = new BN(hash, 16);
    let m = uint128.mul(new BN(diff));
    let maxTarget = new BN(2).pow(new BN(256)).sub(new BN(1));
    //console.log(m, maxTarget, pow.log2(m), pow.log2(maxTarget));
    return m.lt(maxTarget);
}


pow.log2 = function (x) {
    var result = 0;
    if (!BN.isBN(x))
        return -1;
    while (x.toString(10) > 0) {
        x = x.shrn(1);
        result++;
    }

    return result;
}

module.exports = pow;