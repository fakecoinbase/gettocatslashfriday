describe('Transaction check', function () {

    const assert = require('assert');
    const DAPP = require("../../../index");

    let app = new DAPP(require('../../../config.btc-chain.json'));

    process.on('uncaughtException', function (err) {
        console.log('UNCAUGHT EXCEPTION:', err);
    });

    app.on("app.debug", function (data) {
        console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
    });

    app.init();

    describe('Build simple tx', function () {

        it('invalid txin.prevAddress', function () {

            //https://www.blockchain.com/ru/btc/tx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 0,
                        sequence: 0,
                    }
                ], [
                        {
                            amount: 199580800,
                            address: '187DcgKPiLTrZtBwkr35bYyydkNxTjAHya'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ]);
            })
        })


        it('invalid txin.hash', function () {

            //https://www.blockchain.com/ru/btc/tx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        index: 0,
                        sequence: 0,
                        prevAddress: '1GYg3Xjuf2mrdSdW2MR4rnoBJvR9AgiGw9'
                    }
                ], [
                        {
                            amount: 199580800,
                            address: '187DcgKPiLTrZtBwkr35bYyydkNxTjAHya'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ]);
            })
        })

        it('invalid txout.address', function () {

            //https://www.blockchain.com/ru/btc/tx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 0,
                        sequence: 0,
                        prevAddress: '1GYg3Xjuf2mrdSdW2MR4rnoBJvR9AgiGw9'
                    }
                ], [
                        {
                            amount: 199580800,
                            address: 'sfdw323gfwegew'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ]);
            })
        });

        it('invalid txout scriptPubKey', function () {

            //https://www.blockchain.com/ru/btc/tx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 0,
                        sequence: 0,
                        prevAddress: '1GYg3Xjuf2mrdSdW2MR4rnoBJvR9AgiGw9'
                    }
                ], [
                        {
                            amount: 199580800,
                            scriptPubKey: 'not a hex string'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ]);
            })

        });

        it('invalid txout (scriptPubKey or address is not exists)', function () {

            //https://www.blockchain.com/ru/btc/tx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 0,
                        sequence: 0,
                        prevAddress: '1GYg3Xjuf2mrdSdW2MR4rnoBJvR9AgiGw9'
                    }
                ], [
                        {
                            amount: 199580800,
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ]);
            })
        });

        it('invalid keys', function () {

            //https://blockchain.info/rawtx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 0,
                        sequence: 4294967293,
                        prevAddress: '1GYg3Xjuf2mrdSdW2MR4rnoBJvR9AgiGw9'
                    }
                ], [
                        {
                            amount: 199580800,
                            address: '187DcgKPiLTrZtBwkr35bYyydkNxTjAHya'
                        }
                    ],
                    [

                    ], 547587);

            })

        });

        it('create tx from raw + parsing ', function () {

            //https://blockchain.info/rawtx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca

            let tx = app.btcchain.TX.createFromRaw(app, [
                {
                    hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                    index: 0,
                    sequence: 4294967293,
                    prevAddress: '1GYg3Xjuf2mrdSdW2MR4rnoBJvR9AgiGw9'
                }
            ], [
                    {
                        amount: 199580800,
                        address: '187DcgKPiLTrZtBwkr35bYyydkNxTjAHya'
                    }
                ],
                [
                    '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e'
                ], 547587);
            let tx0 = tx.toJSON();
            let tx2 = app.btcchain.TX.fromHEX(app, tx.toHex()).toJSON();

            assert.equal(tx2.version, tx0.version);
            assert.equal(tx2.version, tx0.version);
            assert.equal(tx2.in_count, tx0.in_count);
            assert.equal(tx2.out_count, tx0.out_count);
            assert.equal(tx2.lock_time, tx0.lock_time);
            assert.equal(tx2.hash, tx0.hash);
            assert.equal(tx2.length, tx0.length);

            for (let o in tx0.out) {
                assert.equal(tx0.out[o].amount, tx2.out[o].amount);
                assert.equal(tx0.out[o].scriptPubKey, tx2.out[o].scriptPubKey);
                assert.equal(tx0.out[o].script_len, tx2.out[o].script_len);
            }

            for (let i in tx0.in) {
                assert.equal(tx0.in[i].hash, tx2.in[i].hash);
                assert.equal(tx0.in[i].index, tx2.in[i].index);
                assert.equal(tx0.in[i].scriptSig, tx2.in[i].scriptSig);
                assert.equal(tx0.in[i].script_len, tx2.in[i].script_len);
                assert.equal(tx0.in[i].sequence, tx2.in[i].sequence);
                assert.equal(tx0.in[i].script.der, tx2.in[i].script.der);
                assert.equal(tx0.in[i].script.publicKey, tx2.in[i].script.publicKey);
            }

        });

        /*it('invalid txin.hash', function () {
    
            //https://www.blockchain.com/ru/btc/tx/476fa6355769e31b08d95de710075944f01bf1c39d6b462b1ea95cd95b1051ca
            let testPromise = app.init()
                .then(() => {
                    assert.throws(function () {
                        app.btcchain.TX.createFromRaw(app, [
                            {
                                hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                                index: 0,
                                sequence: 0,
                                prevAddress: '1GYg3Xjuf2mrdSdW2MR4rnoBJvR9AgiGw9'
                            }
                        ], [
                                {
                                    amount: 199580800,
                                    address: ''
                                }
                            ],
                            [
    
                            ]);
                    })
                })
    
            return testPromise.then(function (result) {
    
            })
        });*/

    });
});
