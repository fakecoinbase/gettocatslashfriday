/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

const Uint64LE = require("int64-buffer").Uint64LE;
const bitPony = require('bitpony')
const merkle = require('./merkle');
const BN = require('bn.js');

module.exports = util = {
    BN: BN,
    array_rand: function (arr, count) {
        var r = [];
        for (var i = 0; i < count; i++) {
            r.push(arr[this.rand(0, arr.length)]);
        }

        return r;
    },
    array_shuffle: function (array) {
        var currentIndex = array.length, temporaryValue, randomIndex;
        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    },
    rand: function (min, max) {
        return parseInt(Math.random() * (max - min) + min);
    },
    littleEndian: function (num, longlong) {
        if (!longlong) {
            var buf = Buffer.alloc(4);
            buf.writeUInt32LE(num, 0, true);
            return buf;
        } else {
            var big = new Uint64LE(num);
            return big.toBuffer();
        }
    },
    fromLittleEndian: function (buff, longlong) {
        if (!longlong) {
            return buff.readUInt32LE(0, true);
        } else {
            var big = new Uint64LE(buff);
            return big.toNumber(10);
        }
    },
    numHex: function (s) {
        var a = s.toString(16);
        if ((a.length % 2) > 0) {
            a = "0" + a;
        }
        return a;
    },
    reverseBuffer: function (buff) {
        var out_rev = Buffer.alloc(buff.length), i = 0
        for (; i < buff.length; i++) {
            out_rev[buff.length - 1 - i] = buff[i];
        }

        return out_rev;
    },
    splitBuffer: function (buffer, length) {
        var offset = 0, arr = [];
        do {
            arr.push(buffer.slice(offset, (buffer.length <= offset + length) ? buffer.length : offset + length));
            offset += length;
        } while (offset < buffer.length);

        return arr;
    },
    uniquely: function (arr) {
        var i = 0,
            current,
            length = arr.length,
            unique = [];
        for (; i < length; i++) {
            current = arr[i];
            if (!~unique.indexOf(current)) {
                unique.push(current);
            }
        }
        return unique;
    },
    blockhash: function (headerHex) {
        return 0//bitPony.tool.reverseBuffer(bitPony.tool.sha256(bitPony.tool.sha256(new Buffer(headerHex, 'hex').slice(0, -1)))).toString('hex')
    },
    merkleTree: function (arr) {
        return merkle.tree(util, arr);
    },
    emptyObject: function (obj) {
        return Object.keys(obj).length === 0 && obj.constructor === Object
    },
    bitPony: bitPony
}