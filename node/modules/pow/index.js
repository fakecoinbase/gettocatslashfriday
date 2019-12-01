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
        this.version = this.app.cnf("pow").version
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
            if (this.checkHash(hashResult, difficulty) || this.interuppted) {
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
        let app = this.app;
        if (app.cnf("pow").powVersion == 'monero') {
            if (!target_seconds)
                target_seconds = app.cnf('pow').target;

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

        if (app.cnf('consensus').powVersion == 'bitcoin') {
            let last = app.btcchain.index.get('top');

            if (last.height < app.cnf('consensus').premine)
                return app.cnf('btcpow').maxtarget;

            if (!list.length || last.height == 0)//genesis check
                return app.cnf('btcpow').maxtarget

            let L = app.cnf("btcpow").blockcount;
            let N = difficulties.length;

            let diffCut = app.cnf("btcpow").excludeFirst;
            let diffWindow = L;

            if (diffWindow >= timestamps.length) {
                let cut_end = timestamps.length - diffCut;//dont use 1st block values.
                if (cut_end < 1)
                    cut_end = 0;
                let cut_start = 0;
            } else {
                let cut_end = timestamps.length - diffCut;//dont use 1st block values.
                let cut_start = timestamps.length - diffCut - diffWindow;
            }

            let nActualTimespan = timestamps[cut_end - 1] - timestamps[cut_start];
            if (nActualTimespan <= 0)
                nActualTimespan = 1;

            let nTargetSpacing = app.cnf("btcpow").blockfreq;//one block per N sec
            let nTargetTimespan = app.cnf("btcpow").blockcount;//diff ajustment//one hour

            if (nActualTimespan < (nTargetTimespan - (nTargetTimespan / 4)))
                nActualTimespan = (nTargetTimespan - (nTargetTimespan / 4));

            if (nActualTimespan > (nTargetTimespan + (nTargetTimespan / 2)))
                nActualTimespan = (nTargetTimespan + (nTargetTimespan / 2));

            // Retarget
            let bn = this.bits2targetBN(difficulties[difficulties.length - 1]);
            target = bn.mul(new BN(nActualTimespan)).div(new BN(nTargetTimespan));
            let limit = this.bits2targetBN(app.cnf("btcpow").maxtarget);

            if (target.cmp(limit) == 1) {//target can not be bigger than limit
                target = limit;
            }

            return this.target2bits(target);

        }

        if (app.cnf("consensus").powVersion == 'orwell') {
            return app.orwell.consensus.consensus.next_network_target(app.orwell.index.getTop().height + 1);
        }
    }
    lt(hash, diff) {
        return pow.checkHash(this.app, hash, diff)
    }
    bits2target(bits) {
        return this.bits2targetBN(bits).toBuffer('be', 32);
    }
    bits2targetBN(bits) {
        let p = pow.parts2(bits);
        let F = new BN(8 * (p[0] - 3), 10), tmp = new BN(2, 10).pow(F), R = new BN(p[1], 10).mul(tmp);
        return R;
    }
    target2bits(target) {
        //To convert a positive integer to 'compact' format, we:
        //convert the integer into base 256.
        let b256;
        if (BN.isBN(target))
            b256 = target;
        else
            b256 = new BN(target, 'hex', 'be')
        //if the first (most significant) digit is greater than 127 (0x7f), prepend a zero digit
        let i = b256.toBuffer();
        if (i[0] > 0x7f)
            i = Buffer.concat([new Buffer([0x0]), i]);
        //the first byte of the 'compact' format is the number of digits in the above base 256 representation, including the prepended zero if it's present
        let exp = i.length;
        //the following three bytes are the first three digits of the above representation. If less than three digits are present, then one or more of the last bytes of the compact representation will be zero.
        let bytes = i.slice(0, 3);
        if (bytes.length < 3) {

            if (bytes.length == 2) {
                bytes = Buffer.concat([new Buffer([bytes[0], bytes[1]]), [0x0]]);
            }

            if (bytes.length == 1) {
                bytes = new Buffer([bytes[0], 0x0, 0x0])
            }

            if (bytes.length == 0) {
                bytes = new Buffer([0x0, 0x0, 0x0]);
            }

        }

        return parseInt(parseInt(exp).toString(16) + bytes.toString('hex'), 16)
    }
    compare(needBits, haveBits) {

        let netTarget = this.bits2targetBN(needBits);
        let blockTarget = this.bits2targetBN(haveBits);
        let res = blockTarget.cmp(netTarget); //block target must me less or equal of network target

        return res == -1 || res == 0
    }
    difficulty(bits) {
        let b = new BN(this.bits2target(this.app.cnf('consensus').maxtarget), 16);
        let m = new BN(this.bits2target(bits), 16);
        return (b.div(m).toString(10));
    }
    currHashRate() {
        let dif = this.difficulty(this.app.orwell.getActualDiff());
        let res = new BN(2, 10).pow(new BN(32, 10)).mul(new BN(dif, 10)).div(new BN(300, 10));
        return res.toString(10)
    }
    getBitsRange(nActualTimespan, block) {

        let nTargetSpacing = this.app.cnf("btcpow").blockfreq //one block per N sec
        let nTargetTimespan = this.app.cnf("btcpow").blockcount * nTargetSpacing //diff ajustment//one hour

        //every block
        if (nActualTimespan < (nTargetTimespan - (nTargetTimespan / 4)))
            nActualTimespan = (nTargetTimespan - (nTargetTimespan / 4));

        if (nActualTimespan > (nTargetTimespan + (nTargetTimespan / 2)))
            nActualTimespan = (nTargetTimespan + (nTargetTimespan / 2));

        // Retarget
        let bn = this.bits2targetBN(block.bits);
        let target = bn.mul(new BN(nActualTimespan)).div(new BN(nTargetTimespan));
        let limit = this.bits2targetBN(this.app.cnf("btcpow").maxtarget);

        if (target.cmp(limit) == 1) {//target can not be bigger than limit
            target = limit;
        }

        return this.target2bits(target);
    }
    getBlockValue(fee, height) {
        throw new Error('pow methods is deprecated, use app.orwell.getBlockValue');
        let emission_rules = this.app.cnf("consensus").emission;
        for (let i in emission_rules) {
            let from, to;
            let value = emission_rules[i];
            let a = i.split(",");
            let num = a[0], rule = a[1];
            let nums = num.split("-");
            if (nums.length > 1) {
                from = parseInt(nums[0]);
                to = parseInt(nums[1]);
            } else {
                from = to = parseInt(nums[0]);
            }

            if (from == to && height == from) {
                if (rule == 'height')
                    return new BN(value * height * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
                else
                    return new BN(value * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
            }

            if (from != to && height >= from && height <= to) {
                if (rule == 'height')
                    return new BN(value * height * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
                else
                    return new BN(value * this.app.cnf("consensus").satoshi).add(new BN(fee)).toString(10);
            }
        }

        return fee;
    }
    checkHash(hash, diff) {
        if (this.app.cnf("consensus").powVersion == 'monero') {
            let uint128 = new BN(hash, 16);
            let m = uint128.mul(new BN(diff));
            let maxTarget = new BN(2).pow(new BN(this.app.cnf('pow').maxTarget)).sub(new BN(1));
            //console.log(m, maxTarget, pow.log2(m), pow.log2(maxTarget));
            return m.lt(maxTarget);
        }
        if (this.app.cnf("consensus").powVersion == 'bitcoin') {
            let target = new Buffer(this.bits2target(diff), 'hex');
            //let a_ = new BN(a), b_ = new BN(b);
            //console.log(hash, target.toString('hex'), new BN(hash).lt(new BN(target)));process.exit();
            let res = new BN(hash).lt(new BN(target));
            //let la = pow.log2(a_);
            //if (config.debug.mining)
            //     console.log("        " + la, log2(b_), res);

            return res;
        }

        if (this.app.cnf("consensus").powVersion == 'orwell') {
            return this.app.orwell.consensus.consensus.checkHash(hash, diff);
        }
    }
}

pow.parts2 = function (bits) {
    let exp = bits >> 24,
        mant = bits & 0xffffff;
    return [exp, mant];
}

pow.parts = function (bits) {
    let exp = bits >> 32,
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
    throw new Error('deprecated');
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