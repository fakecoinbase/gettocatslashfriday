describe('Transaction check', function () {

    const assert = require('assert');
    const DAPP = require("../../index");

    let app = new DAPP(require('../../config.btc-chain.json'));

    process.on('uncaughtException', function (err) {
        console.log('UNCAUGHT EXCEPTION:', err);
    });

    app.on("app.debug", function (data) {
        console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
    });

    app.init();

    describe('Build big tx', function () {

        it('invalid txin.prevAddress 2', function () {

            //https://api.blockchair.com/bitcoin/dashboards/transaction/23aa9d0fdf95c77628aa56e0cf5b5195c6cce338e491fdcbb63e30ba5873e8f6

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '204bc1572552463b70b32e08f1496241d91377953143d84a674c31b404e8cad7',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '1dc9a5f1d57046ea7b49642c8bcec2c5595577936d7a968c4bf52cbe31466c70',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '76a47df69428c622a7137bd30f2c1326d4e2968c3787d255b1c234446579ff52',
                        index: 0,
                        sequence: 4294967294,
                    },
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 1,
                        sequence: 4294967294,
                        prevAddress: '1HXpg8D9AMGFVZ9FEU2tkZYvAZ8xBhVudo'
                    }
                ], [
                        {
                            amount: 3096469,
                            address: '3KxzQ5z1HWEvGEe7vfEbfLASPyJk8cVaXk'
                        },
                        {
                            amount: 865743,
                            address: '1A61JperLcNWmkZD74FB5Pqk7JyYxTZMh5'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ], 547866, 2);
            })
        })


        it('invalid txin.hash', function () {

            //https://www.blockchain.com/ru/btc/tx/23aa9d0fdf95c77628aa56e0cf5b5195c6cce338e491fdcbb63e30ba5873e8f6

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '204bc1572552463b70b32e08f1496241d91377953143d84a674c31b404e8cad7',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '76a47df69428c622a7137bd30f2c1326d4e2968c3787d255b1c234446579ff52',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1D7GYowQqZJ8SK4vdkkossQThWvhZkX2R1'
                    },
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 1,
                        sequence: 4294967294,
                        prevAddress: '1HXpg8D9AMGFVZ9FEU2tkZYvAZ8xBhVudo'
                    }
                ], [
                        {
                            amount: 3096469,
                            address: '3KxzQ5z1HWEvGEe7vfEbfLASPyJk8cVaXk'
                        },
                        {
                            amount: 865743,
                            address: '1A61JperLcNWmkZD74FB5Pqk7JyYxTZMh5'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ], 547866, 2);
            })
        })

        it('invalid txout.address', function () {

            //https://www.blockchain.com/ru/btc/tx/23aa9d0fdf95c77628aa56e0cf5b5195c6cce338e491fdcbb63e30ba5873e8f6

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '204bc1572552463b70b32e08f1496241d91377953143d84a674c31b404e8cad7',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '1dc9a5f1d57046ea7b49642c8bcec2c5595577936d7a968c4bf52cbe31466c70',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '76a47df69428c622a7137bd30f2c1326d4e2968c3787d255b1c234446579ff52',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1D7GYowQqZJ8SK4vdkkossQThWvhZkX2R1'
                    },
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 1,
                        sequence: 4294967294,
                        prevAddress: '1HXpg8D9AMGFVZ9FEU2tkZYvAZ8xBhVudo'
                    }
                ], [
                        {
                            amount: 3096469,
                            address: '3KxzQ5z1HWEvGEe7vfEbfLASPyJk8cVaXk'
                        },
                        {
                            amount: 865743,
                            address: 'sgerhwrbheh'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ], 547866, 2);
            })
        });

        it('invalid txout scriptPubKey', function () {

            //https://www.blockchain.com/ru/btc/tx/23aa9d0fdf95c77628aa56e0cf5b5195c6cce338e491fdcbb63e30ba5873e8f6

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '204bc1572552463b70b32e08f1496241d91377953143d84a674c31b404e8cad7',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '1dc9a5f1d57046ea7b49642c8bcec2c5595577936d7a968c4bf52cbe31466c70',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '76a47df69428c622a7137bd30f2c1326d4e2968c3787d255b1c234446579ff52',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1D7GYowQqZJ8SK4vdkkossQThWvhZkX2R1'
                    },
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 1,
                        sequence: 4294967294,
                        prevAddress: '1HXpg8D9AMGFVZ9FEU2tkZYvAZ8xBhVudo'
                    }
                ], [
                        {
                            amount: 3096469,
                            address: '3KxzQ5z1HWEvGEe7vfEbfLASPyJk8cVaXk'
                        },
                        {
                            amount: 865743,
                            scriptPubKey: '1A61JperLcNWmkZD74FB5Pqk7JyYxTZMh5'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ], 547866, 2);
            })

        });

        it('invalid txout (scriptPubKey or address is not exists)', function () {

            //https://www.blockchain.com/ru/btc/tx/23aa9d0fdf95c77628aa56e0cf5b5195c6cce338e491fdcbb63e30ba5873e8f6

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '204bc1572552463b70b32e08f1496241d91377953143d84a674c31b404e8cad7',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '1dc9a5f1d57046ea7b49642c8bcec2c5595577936d7a968c4bf52cbe31466c70',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '76a47df69428c622a7137bd30f2c1326d4e2968c3787d255b1c234446579ff52',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1D7GYowQqZJ8SK4vdkkossQThWvhZkX2R1'
                    },
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 1,
                        sequence: 4294967294,
                        prevAddress: '1HXpg8D9AMGFVZ9FEU2tkZYvAZ8xBhVudo'
                    }
                ], [
                        {
                            amount: 3096469,
                            address: '3KxzQ5z1HWEvGEe7vfEbfLASPyJk8cVaXk'
                        },
                        {
                            amount: 865743,
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ], 547866, 2);
            })
        });

        it('invalid keys', function () {

            //https://blockchain.info/rawtx/23aa9d0fdf95c77628aa56e0cf5b5195c6cce338e491fdcbb63e30ba5873e8f6

            assert.throws(function () {
                app.btcchain.TX.createFromRaw(app, [
                    {
                        hash: '204bc1572552463b70b32e08f1496241d91377953143d84a674c31b404e8cad7',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '1dc9a5f1d57046ea7b49642c8bcec2c5595577936d7a968c4bf52cbe31466c70',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                    },
                    {
                        hash: '76a47df69428c622a7137bd30f2c1326d4e2968c3787d255b1c234446579ff52',
                        index: 0,
                        sequence: 4294967294,
                        prevAddress: '1D7GYowQqZJ8SK4vdkkossQThWvhZkX2R1'
                    },
                    {
                        hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                        index: 1,
                        sequence: 4294967294,
                        prevAddress: '1HXpg8D9AMGFVZ9FEU2tkZYvAZ8xBhVudo'
                    }
                ], [
                        {
                            amount: 3096469,
                            address: '3KxzQ5z1HWEvGEe7vfEbfLASPyJk8cVaXk'
                        },
                        {
                            amount: 865743,
                            address: '1A61JperLcNWmkZD74FB5Pqk7JyYxTZMh5'
                        }
                    ],
                    [
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                        '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    ], 547866, 2);

            })

        });

        it('create tx from raw + parsing ', function () {

            //https://blockchain.info/rawtx/23aa9d0fdf95c77628aa56e0cf5b5195c6cce338e491fdcbb63e30ba5873e8f6

            let tx = app.btcchain.TX.createFromRaw(app, [
                {
                    hash: '204bc1572552463b70b32e08f1496241d91377953143d84a674c31b404e8cad7',
                    index: 0,
                    sequence: 4294967294,
                    prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                },
                {
                    hash: '1dc9a5f1d57046ea7b49642c8bcec2c5595577936d7a968c4bf52cbe31466c70',
                    index: 0,
                    sequence: 4294967294,
                    prevAddress: '1Q6TGRbKyQPjXCdRv5Ad6g7WSK6a7hHyiH'
                },
                {
                    hash: '76a47df69428c622a7137bd30f2c1326d4e2968c3787d255b1c234446579ff52',
                    index: 0,
                    sequence: 4294967294,
                    prevAddress: '1D7GYowQqZJ8SK4vdkkossQThWvhZkX2R1'
                },
                {
                    hash: '0c1ab6dd93ae4698b52f0dbaf19cda2a9205abdaa4ae6c5f355dfc357c4d56ec',
                    index: 1,
                    sequence: 4294967294,
                    prevAddress: '1HXpg8D9AMGFVZ9FEU2tkZYvAZ8xBhVudo'
                }
            ], [
                    {
                        amount: 3096469,
                        address: '3KxzQ5z1HWEvGEe7vfEbfLASPyJk8cVaXk'
                    },
                    {
                        amount: 865743,
                        address: '1A61JperLcNWmkZD74FB5Pqk7JyYxTZMh5'
                    }
                ],
                [
                    '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                    '71f5c55e62e9a1dac158b7602a64ca0c3581d48ba28228c6180913fffcf0df7e',
                ], 547866, 2);
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

    });
});
