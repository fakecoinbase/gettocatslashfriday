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

    describe('Build coinbase tx', function () {

        it('invalid out address', function () {

            assert.throws(function () {

                //https://www.blockchain.com/ru/btc/tx/a8d0c0184dde994a09ec054286f1ce581bebf46446a512166eae7628734ea0a5
                app.btcchain.TX.createCoinbase(app,
                    {
                        version: 1,
                        in: [{
                            scriptSig: new Buffer("03801a060004cc2acf560433c30f37085d4a39ad543b0c000a425720537570706f727420384d200a666973686572206a696e78696e092f425720506f6f6c2f", "hex"),
                            sequence: 4294967295,
                        }],
                        out: [{
                            amount: 2533349423,
                            address: '1BQLNJtMDKmMZ434124PyqVFfRuBNvoGhjigBKF'
                        }],
                        lock_time: 0
                    }
                );


            });
        });

        it('invalid out scriptPubKey', function () {

            assert.throws(function () {

                //https://www.blockchain.com/ru/btc/tx/a8d0c0184dde994a09ec054286f1ce581bebf46446a512166eae7628734ea0a5
                app.btcchain.TX.createCoinbase(app,
                    {
                        version: 1,
                        in: [{
                            scriptSig: new Buffer("03801a060004cc2acf560433c30f37085d4a39ad543b0c000a425720537570706f727420384d200a666973686572206a696e78696e092f425720506f6f6c2f", "hex"),
                            sequence: 4294967295,
                        }],
                        out: [{
                            amount: 2533349423,
                            scriptPubKey: '1BQLNJtMDKmMZ434124PyqVFfRuBNvoGhjigBKF'
                        }],
                        lock_time: 0
                    }
                );


            });
        });

        it('empty out address/scriptPubKey', function () {

            assert.throws(function () {

                //https://www.blockchain.com/ru/btc/tx/a8d0c0184dde994a09ec054286f1ce581bebf46446a512166eae7628734ea0a5
                app.btcchain.TX.createCoinbase(app,
                    {
                        version: 1,
                        in: [{
                            scriptSig: new Buffer("03801a060004cc2acf560433c30f37085d4a39ad543b0c000a425720537570706f727420384d200a666973686572206a696e78696e092f425720506f6f6c2f", "hex"),
                            sequence: 4294967295,
                        }],
                        out: [{
                            amount: 2533349423,
                        }],
                        lock_time: 0
                    }
                );


            });
        });

        it('empty in.scriptSig (coinbase data)', function () {

            assert.throws(function () {

                //https://www.blockchain.com/ru/btc/tx/a8d0c0184dde994a09ec054286f1ce581bebf46446a512166eae7628734ea0a5
                app.btcchain.TX.createCoinbase(app,
                    {
                        version: 1,
                        in: [{
                            sequence: 4294967295,
                        }],
                        out: [{
                            amount: 2533349423,
                            address: '1BQLNJtMDKmMZ4PyqVFfRuBNvoGhjigBKF'
                        }],
                        lock_time: 0
                    }
                );


            });
        });

        it('invalid txdata format', function () {

            assert.throws(function () {

                //https://www.blockchain.com/ru/btc/tx/a8d0c0184dde994a09ec054286f1ce581bebf46446a512166eae7628734ea0a5
                app.btcchain.TX.createCoinbase(app,
                    {
                        version: 1,
                        lock_time: 0
                    }
                );


            });
        });

        it('valid coinbase generation', function () {

            //https://www.blockchain.com/ru/btc/tx/a8d0c0184dde994a09ec054286f1ce581bebf46446a512166eae7628734ea0a5
            let tx = app.btcchain.TX.createCoinbase(app,
                {
                    version: 1,
                    in: [{
                        scriptSig: new Buffer("03801a060004cc2acf560433c30f37085d4a39ad543b0c000a425720537570706f727420384d200a666973686572206a696e78696e092f425720506f6f6c2f", "hex"),
                        sequence: 4294967295,
                    }],
                    out: [{
                        amount: 2533349423,
                        address: '1BQLNJtMDKmMZ4PyqVFfRuBNvoGhjigBKF'
                    }],
                    lock_time: 0
                }
            );

            assert.equal(tx.getId(), "a8d0c0184dde994a09ec054286f1ce581bebf46446a512166eae7628734ea0a5");
        });

    });

});
