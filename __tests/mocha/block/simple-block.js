describe('Block check', function () {

    const assert = require('assert');
    const DAPP = require("../../../index");

    let app = new DAPP(require('../../../config.btc-chain.json'));

    process.on('uncaughtException', function (err) {
        console.log('UNCAUGHT EXCEPTION:', err);
    });

    app.on("app.debug", function (data) {
        console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
    });

    app.init()


    app.on('init', () => {
        console.log('inited');


        describe('Simple block', function () {

            it('parsing from hex ok', function () {

                //https://www.blockchain.com/ru/btc/block/000000000003ba27aa200b1cecaad478d2b00432346c3f1f3986da1afd33e506
                //assert.throws(function () {
                let HEX = '0100000050120119172a610421a6c3011dd330d9df07b63616c2cc1f1cd00200000000006657a9252aacd5c0b2940996ecff952228c3067cc38d4885efb5a4ac4247e9f337221b4d4c86041b0f2b57100401000000010000000000000000000000000000000000000000000000000000000000000000ffffffff08044c86041b020602ffffffff0100f2052a010000004341041b0e8c2567c12536aa13357b79a073dc4444acb83c4ec7a0e2f99dd7457516c5817242da796924ca4e99947d087fedf9ce467cb9f7c6287078f801df276fdf84ac000000000100000001032e38e9c0a84c6046d687d10556dcacc41d275ec55fc00779ac88fdf357a187000000008c493046022100c352d3dd993a981beba4a63ad15c209275ca9470abfcd57da93b58e4eb5dce82022100840792bc1f456062819f15d33ee7055cf7b5ee1af1ebcc6028d9cdb1c3af7748014104f46db5e9d61a9dc27b8d64ad23e7383a4e6ca164593c2527c038c0857eb67ee8e825dca65046b82c9331586c82e0fd1f633f25f87c161bc6f8a630121df2b3d3ffffffff0200e32321000000001976a914c398efa9c392ba6013c5e04ee729755ef7f58b3288ac000fe208010000001976a914948c765a6914d43f2a7ac177da2c2f6b52de3d7c88ac000000000100000001c33ebff2a709f13d9f9a7569ab16a32786af7d7e2de09265e41c61d078294ecf010000008a4730440220032d30df5ee6f57fa46cddb5eb8d0d9fe8de6b342d27942ae90a3231e0ba333e02203deee8060fdc70230a7f5b4ad7d7bc3e628cbe219a886b84269eaeb81e26b4fe014104ae31c31bf91278d99b8377a35bbce5b27d9fff15456839e919453fc7b3f721f0ba403ff96c9deeb680e5fd341c0fc3a7b90da4631ee39560639db462e9cb850fffffffff0240420f00000000001976a914b0dcbf97eabf4404e31d952477ce822dadbe7e1088acc060d211000000001976a9146b1281eec25ab4e1e0793ff4e08ab1abb3409cd988ac0000000001000000010b6072b386d4a773235237f64c1126ac3b240c84b917a3909ba1c43ded5f51f4000000008c493046022100bb1ad26df930a51cce110cf44f7a48c3c561fd977500b1ae5d6b6fd13d0b3f4a022100c5b42951acedff14abba2736fd574bdb465f3e6f8da12e2c5303954aca7f78f3014104a7135bfe824c97ecc01ec7d7e336185c81e2aa2c41ab175407c09484ce9694b44953fcb751206564a9c24dd094d42fdbfdd5aad3e063ce6af4cfaaea4ea14fbbffffffff0140420f00000000001976a91439aa3d569e06a1d7926dc4be1193c99bf2eb9ee088ac00000000';
                let b = app.btcchain.BLOCK.fromHEX(app, HEX);
                let block = b.toJSON();

                assert.equal(HEX, b.toHex());

                assert.equal(block.hash, "000000000003ba27aa200b1cecaad478d2b00432346c3f1f3986da1afd33e506");
                assert.equal(block.hashPrevBlock, "000000000002d01c1fccc21636b607dfd930d31d01c3a62104612a1719011250");
                assert.equal(block.hashMerkleRoot, "f3e94742aca4b5ef85488dc37c06c3282295ffec960994b2c0d5ac2a25a95766");
                assert.equal(block.time, 1293623863);
                assert.equal(block.bits, 453281356);
                assert.equal(block.nonce, 274148111);
                console.log(block)

                let tx0 = block.tx[0];
                assert.equal(1, tx0.version);
                assert.equal(1, tx0.in_count);
                assert.equal(1, tx0.out_count);
                assert.equal(0, tx0.lock_time);
                assert.equal("8c14f0db3df150123e6f3dbbf30f8b955a8249b62ac1d1ff16284aefa3d06d87", tx0.hash);

                assert.equal(tx0.out[0].scriptPubKey, "41041b0e8c2567c12536aa13357b79a073dc4444acb83c4ec7a0e2f99dd7457516c5817242da796924ca4e99947d087fedf9ce467cb9f7c6287078f801df276fdf84ac");
                assert.equal(tx0.out[0].amount, "5000000000");

                assert.equal(tx0.in[0].scriptSig, "044c86041b020602");
                assert.equal(tx0.in[0].hash, "0000000000000000000000000000000000000000000000000000000000000000");
                assert.equal(tx0.in[0].index, 0xffffffff);
                assert.equal(tx0.in[0].sequence, 0xffffffff);


                let tx1 = block.tx[1];
                assert.equal(1, tx1.version);
                assert.equal(1, tx1.in_count);
                assert.equal(2, tx1.out_count);
                assert.equal(0, tx1.lock_time);
                assert.equal("fff2525b8931402dd09222c50775608f75787bd2b87e56995a7bdd30f79702c4", tx1.hash);

                assert.equal(tx1.out[0].scriptPubKey, "76a914c398efa9c392ba6013c5e04ee729755ef7f58b3288ac");
                assert.equal(tx1.out[0].amount, "556000000");

                assert.equal(tx1.out[1].scriptPubKey, "76a914948c765a6914d43f2a7ac177da2c2f6b52de3d7c88ac");
                assert.equal(tx1.out[1].amount, "4444000000");

                assert.equal(tx1.in[0].scriptSig, "493046022100c352d3dd993a981beba4a63ad15c209275ca9470abfcd57da93b58e4eb5dce82022100840792bc1f456062819f15d33ee7055cf7b5ee1af1ebcc6028d9cdb1c3af7748014104f46db5e9d61a9dc27b8d64ad23e7383a4e6ca164593c2527c038c0857eb67ee8e825dca65046b82c9331586c82e0fd1f633f25f87c161bc6f8a630121df2b3d3");
                assert.equal(tx1.in[0].hash, "87a157f3fd88ac7907c05fc55e271dc4acdc5605d187d646604ca8c0e9382e03");
                assert.equal(tx1.in[0].index, 0);
                assert.equal(tx1.in[0].sequence, 0xffffffff);

                let tx2 = block.tx[2];
                assert.equal(1, tx2.version);
                assert.equal(1, tx2.in_count);
                assert.equal(2, tx2.out_count);
                assert.equal(0, tx2.lock_time);
                assert.equal("6359f0868171b1d194cbee1af2f16ea598ae8fad666d9b012c8ed2b79a236ec4", tx2.hash);

                assert.equal(tx2.out[0].scriptPubKey, "76a914b0dcbf97eabf4404e31d952477ce822dadbe7e1088ac");
                assert.equal(tx2.out[0].amount, "1000000");

                assert.equal(tx2.out[1].scriptPubKey, "76a9146b1281eec25ab4e1e0793ff4e08ab1abb3409cd988ac");
                assert.equal(tx2.out[1].amount, "299000000");

                assert.equal(tx2.in[0].scriptSig, "4730440220032d30df5ee6f57fa46cddb5eb8d0d9fe8de6b342d27942ae90a3231e0ba333e02203deee8060fdc70230a7f5b4ad7d7bc3e628cbe219a886b84269eaeb81e26b4fe014104ae31c31bf91278d99b8377a35bbce5b27d9fff15456839e919453fc7b3f721f0ba403ff96c9deeb680e5fd341c0fc3a7b90da4631ee39560639db462e9cb850f");
                assert.equal(tx2.in[0].hash, "cf4e2978d0611ce46592e02d7e7daf8627a316ab69759a9f3df109a7f2bf3ec3");
                assert.equal(tx2.in[0].index, 1);
                assert.equal(tx2.in[0].sequence, 0xffffffff);

                let tx3 = block.tx[3];
                assert.equal(1, tx3.version);
                assert.equal(1, tx3.in_count);
                assert.equal(1, tx3.out_count);
                assert.equal(0, tx3.lock_time);
                assert.equal("e9a66845e05d5abc0ad04ec80f774a7e585c6e8db975962d069a522137b80c1d", tx3.hash);

                assert.equal(tx3.out[0].scriptPubKey, "76a91439aa3d569e06a1d7926dc4be1193c99bf2eb9ee088ac");
                assert.equal(tx3.out[0].amount, "1000000");

                assert.equal(tx3.in[0].scriptSig, "493046022100bb1ad26df930a51cce110cf44f7a48c3c561fd977500b1ae5d6b6fd13d0b3f4a022100c5b42951acedff14abba2736fd574bdb465f3e6f8da12e2c5303954aca7f78f3014104a7135bfe824c97ecc01ec7d7e336185c81e2aa2c41ab175407c09484ce9694b44953fcb751206564a9c24dd094d42fdbfdd5aad3e063ce6af4cfaaea4ea14fbb");
                assert.equal(tx3.in[0].hash, "f4515fed3dc4a19b90a317b9840c243bac26114cf637522373a7d486b372600b");
                assert.equal(tx3.in[0].index, 0);
                assert.equal(tx3.in[0].sequence, 0xffffffff);

                //})
            })

            it('build from json ok', function () {

                let block = app.btcchain.BLOCK.fromJSON(app, {
                    version: 1,
                    hashPrevBlock: '000000000002d01c1fccc21636b607dfd930d31d01c3a62104612a1719011250',
                    hashMerkleRoot: 'f3e94742aca4b5ef85488dc37c06c3282295ffec960994b2c0d5ac2a25a95766',
                    time: 1293623863,
                    bits: 453281356,
                    nonce: 274148111,
                    tx: [
                        {
                            version: 1,
                            lock_time: 0,
                            in: [
                                {
                                    hash: '0000000000000000000000000000000000000000000000000000000000000000',
                                    index: 0xffffffff,
                                    scriptSig: '044c86041b020602',
                                    sequence: 0xffffffff,

                                }
                            ],
                            out: [
                                {
                                    scriptPubKey: '41041b0e8c2567c12536aa13357b79a073dc4444acb83c4ec7a0e2f99dd7457516c5817242da796924ca4e99947d087fedf9ce467cb9f7c6287078f801df276fdf84ac',
                                    amount: '5000000000',
                                }
                            ]
                        },
                        {
                            version: 1,
                            lock_time: 0,
                            in: [
                                {
                                    hash: '87a157f3fd88ac7907c05fc55e271dc4acdc5605d187d646604ca8c0e9382e03',
                                    index: 0,
                                    scriptSig: '493046022100c352d3dd993a981beba4a63ad15c209275ca9470abfcd57da93b58e4eb5dce82022100840792bc1f456062819f15d33ee7055cf7b5ee1af1ebcc6028d9cdb1c3af7748014104f46db5e9d61a9dc27b8d64ad23e7383a4e6ca164593c2527c038c0857eb67ee8e825dca65046b82c9331586c82e0fd1f633f25f87c161bc6f8a630121df2b3d3',
                                    sequence: 0xffffffff,

                                }
                            ],
                            out: [
                                {
                                    scriptPubKey: '76a914c398efa9c392ba6013c5e04ee729755ef7f58b3288ac',
                                    amount: '556000000',
                                },
                                {
                                    scriptPubKey: '76a914948c765a6914d43f2a7ac177da2c2f6b52de3d7c88ac',
                                    amount: '4444000000'
                                }
                            ]
                        },
                        '0100000001c33ebff2a709f13d9f9a7569ab16a32786af7d7e2de09265e41c61d078294ecf010000008a4730440220032d30df5ee6f57fa46cddb5eb8d0d9fe8de6b342d27942ae90a3231e0ba333e02203deee8060fdc70230a7f5b4ad7d7bc3e628cbe219a886b84269eaeb81e26b4fe014104ae31c31bf91278d99b8377a35bbce5b27d9fff15456839e919453fc7b3f721f0ba403ff96c9deeb680e5fd341c0fc3a7b90da4631ee39560639db462e9cb850fffffffff0240420f00000000001976a914b0dcbf97eabf4404e31d952477ce822dadbe7e1088acc060d211000000001976a9146b1281eec25ab4e1e0793ff4e08ab1abb3409cd988ac00000000',
                        app.btcchain.TX.fromJSON(app, {
                            version: 1,
                            lock_time: 0,
                            in: [
                                {
                                    hash: 'f4515fed3dc4a19b90a317b9840c243bac26114cf637522373a7d486b372600b',
                                    index: 0,
                                    sequence: 0xffffffff,
                                    scriptSig: '493046022100bb1ad26df930a51cce110cf44f7a48c3c561fd977500b1ae5d6b6fd13d0b3f4a022100c5b42951acedff14abba2736fd574bdb465f3e6f8da12e2c5303954aca7f78f3014104a7135bfe824c97ecc01ec7d7e336185c81e2aa2c41ab175407c09484ce9694b44953fcb751206564a9c24dd094d42fdbfdd5aad3e063ce6af4cfaaea4ea14fbb'
                                }
                            ],
                            out: [
                                {
                                    scriptPubKey: '76a91439aa3d569e06a1d7926dc4be1193c99bf2eb9ee088ac',
                                    amount: '1000000'
                                }
                            ]
                        })
                    ]
                });

                let b = block.toJSON();
                assert.equal(block.toHex(), '0100000050120119172a610421a6c3011dd330d9df07b63616c2cc1f1cd00200000000006657a9252aacd5c0b2940996ecff952228c3067cc38d4885efb5a4ac4247e9f337221b4d4c86041b0f2b57100401000000010000000000000000000000000000000000000000000000000000000000000000ffffffff08044c86041b020602ffffffff0100f2052a010000004341041b0e8c2567c12536aa13357b79a073dc4444acb83c4ec7a0e2f99dd7457516c5817242da796924ca4e99947d087fedf9ce467cb9f7c6287078f801df276fdf84ac000000000100000001032e38e9c0a84c6046d687d10556dcacc41d275ec55fc00779ac88fdf357a187000000008c493046022100c352d3dd993a981beba4a63ad15c209275ca9470abfcd57da93b58e4eb5dce82022100840792bc1f456062819f15d33ee7055cf7b5ee1af1ebcc6028d9cdb1c3af7748014104f46db5e9d61a9dc27b8d64ad23e7383a4e6ca164593c2527c038c0857eb67ee8e825dca65046b82c9331586c82e0fd1f633f25f87c161bc6f8a630121df2b3d3ffffffff0200e32321000000001976a914c398efa9c392ba6013c5e04ee729755ef7f58b3288ac000fe208010000001976a914948c765a6914d43f2a7ac177da2c2f6b52de3d7c88ac000000000100000001c33ebff2a709f13d9f9a7569ab16a32786af7d7e2de09265e41c61d078294ecf010000008a4730440220032d30df5ee6f57fa46cddb5eb8d0d9fe8de6b342d27942ae90a3231e0ba333e02203deee8060fdc70230a7f5b4ad7d7bc3e628cbe219a886b84269eaeb81e26b4fe014104ae31c31bf91278d99b8377a35bbce5b27d9fff15456839e919453fc7b3f721f0ba403ff96c9deeb680e5fd341c0fc3a7b90da4631ee39560639db462e9cb850fffffffff0240420f00000000001976a914b0dcbf97eabf4404e31d952477ce822dadbe7e1088acc060d211000000001976a9146b1281eec25ab4e1e0793ff4e08ab1abb3409cd988ac0000000001000000010b6072b386d4a773235237f64c1126ac3b240c84b917a3909ba1c43ded5f51f4000000008c493046022100bb1ad26df930a51cce110cf44f7a48c3c561fd977500b1ae5d6b6fd13d0b3f4a022100c5b42951acedff14abba2736fd574bdb465f3e6f8da12e2c5303954aca7f78f3014104a7135bfe824c97ecc01ec7d7e336185c81e2aa2c41ab175407c09484ce9694b44953fcb751206564a9c24dd094d42fdbfdd5aad3e063ce6af4cfaaea4ea14fbbffffffff0140420f00000000001976a91439aa3d569e06a1d7926dc4be1193c99bf2eb9ee088ac00000000');

            })


        });
    })
});
