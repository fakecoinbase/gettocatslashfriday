const express = require('express');
const bitPony = require('bitpony');

module.exports = (app) => {

    const router = express.Router();

    router.get('/block/:hash', function (req, res, next) {
        let d = app.rpc.handlers.block('block', [req.params.hash]);
        let block = d[1][0];
        if (d[0])
            throw new Error(d[0]);
        res.render('explorer/block', { title: 'Block', block: block });
    });

    router.get('/height/:height', function (req, res, next) {
        let d = app.rpc.handlers.block('height', [req.params.height]);
        let block = d[1][0];
        if (d[0])
            throw new Error(d[0]);
        res.render('explorer/block', { title: 'Height #' + req.params.height, block: block });
    });

    router.get('/tx/:hash', function (req, res, next) {

        let id = req.query.id || 0;
        let txs = req.params.hash.split(",");

        if (id > txs.length - 1)
            id = 0;

        let d = app.rpc.handlers.tx([txs[id]]);
        let tx = d[1];
        if (d[0])
            throw new Error(d[0]);

        res.render('explorer/tx', { title: 'Tx', tx: tx, id: id, txs: txs });
    });

    router.get('/address/:address', function (req, res, next) {

        let onpage = 100;
        let page = parseInt(req.query.page) || 1;
        let offset = onpage * (page - 1);

        let d = app.rpc.handlers.address([req.params.address, onpage, offset]);
        let address = d[1];

        if (d[0])
            throw new Error(d[0]);

        let items = address.unspent.count;
        let pages = Math.ceil(items / onpage);

        if (page > pages)
            page = 1;

        address.pager = {
            'path': '?',
            'count': address.unspent.count,
            'pages': pages,
            'page': page,
            'onpage': onpage,
            'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
            'nearRight': (page + 2 > pages) ? pages : page + 2,
        }

        res.render('explorer/address', { title: 'Address', address: address });
    });

    router.get('/tokens/:address', function (req, res, next) {

        let onpage = 100;
        let page = parseInt(req.query.page) || 1;
        let offset = onpage * (page - 1);

        let d = app.rpc.handlers.tokenAddressHistory([req.params.address, onpage, offset]);
        let address = d[1];

        if (d[0])
            throw new Error(d[0]);

        let items = address.count;
        let pages = Math.ceil(items / onpage);

        if (page > pages)
            page = 1;

        address.pager = {
            'path': '?',
            'count': address.count,
            'pages': pages,
            'page': page,
            'onpage': onpage,
            'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
            'nearRight': (page + 2 > pages) ? pages : page + 2,
        }
        
        let balances = app.orwell.getTokensAddressAmount(req.params.address);
        let hashQuery = app.orwell.ADDRESS.getPublicKeyHashByAddress(req.params.address).toString('hex')
        res.render('explorer/addresstokens', { addressQuery: req.params.address, hashQuery: hashQuery, title: 'Address tokens', balances, tokens: address });
    });

    router.get('/db/:addr/:dataset?', function (req, res, next) {

        if (!/^[a-z0-9]{10,130}$/.test(req.params.addr)) {
            throw new Error('Invalid database name');
        }

        let dataset = req.params.dataset;
        let onpage = 100;
        let page = parseInt(req.query.page);
        if (!page)
            page = 1;

        let offset = onpage * (page - 1);
        let params = [];

        if (dataset)
            params = [req.params.addr, req.params.dataset, onpage, offset];
        else
            params = [req.params.addr];

        app.rpc.handlers.dbinfo(params, (error, result) => {
            let db = result;
            if (error)
                throw new Error(error);

            let items = db['count'];
            let pages = Math.ceil(items / onpage);

            if (page > pages)
                page = 1;

            db['pager'] = {
                'path': '?',
                'count': db.count,
                'pages': pages,
                'page': page,
                'onpage': onpage,
                'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
                'nearRight': (page + 2 > pages) ? pages : page + 2,
            };

            res.render('explorer/db', { title: 'Database info', db: db });
        });

    });

    router.get('/databases', function (req, res, next) {

        let onpage = 30;
        let page = parseInt(req.query.page);
        if (!page)
            page = 1;

        let offset = onpage * (page - 1);

        let d = app.rpc.handlers.dblist([onpage, offset]);
        let dblist = d[1];

        if (d[0])
            throw new Error(d[0]);

        let items = dblist['count'];
        let pages = Math.ceil(items / onpage);

        if (page > pages)
            page = 1;

        dblist['pager'] = {
            'path': '?',
            'count': dblist['count'],
            'pages': pages,
            'page': page,
            'onpage': onpage,
            'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
            'nearRight': (page + 2 > pages) ? pages : page + 2,
        }

        res.render('explorer/databases', { title: 'Databases', db: dblist });
    });


    router.get('/tokens', function (req, res, next) {

        let onpage = 100;
        let page = parseInt(req.query.page);
        if (!page)
            page = 1;

        let offset = onpage * (page - 1);

        let d = app.rpc.handlers.tokenList([onpage, offset]);
        let tokenslist = d[1];

        if (d[0])
            throw new Error(d[0]);
            
        let items = tokenslist['count'];
        let pages = Math.ceil(items / onpage);

        if (page > pages)
            page = 1;

        tokenslist['pager'] = {
            'path': '?',
            'count': items,
            'pages': pages,
            'page': page,
            'onpage': onpage,
            'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
            'nearRight': (page + 2 > pages) ? pages : page + 2,
        }

        res.render('explorer/tokens', { title: 'Tokens', tokens: tokenslist });
    });

    router.get('/', function (req, res, next) {

        let onpage = 100;
        let page = parseInt(req.query.page);
        if (!page)
            page = 1;

        if (req.query.q) {
            let getUrl = (url) => {
                try {
                    let hash = url;

                    if (/^[0-9]+$/is.test(hash)) {//is index
                        let d = app.rpc.handlers.block('height', [hash]);
                        let block = d[1][0];

                        if (block && block.hash)
                            return ("/explorer/block/" + block.hash);
                    }

                    if (!/^([0-9a-z]{1,150})$/is.test(hash))
                        throw new Error("Invalid hex string");

                    //try to block
                    let d = app.rpc.handlers.block('block', [hash]);
                    let block = d[1][0];

                    if (block && block.hash)
                        return ("/explorer/block/" + block.hash);

                    //try to tx
                    let d2 = app.rpc.handlers.tx([hash]);
                    let tx = d2[1];

                    if (tx && tx.hash)
                        return ("/explorer/tx/" + tx.hash);

                    //try address
                    let d3 = app.rpc.handlers.address([hash]);
                    let address = d3[1];

                    if (!address || !address.address)
                        throw new Error('not address');

                    return ("/explorer/address/" + address.address);
                } catch (e) {
                    return "/explorer";
                }
            }

            let url = getUrl(req.query.q);
            res.redirect(url);
            return;
        }

        let offset = onpage * (page - 1);
        let d = app.rpc.handlers.chain([onpage, offset]);

        let chain = d[1];
        if (d[0])
            throw new Error(d[0]);

        let items = chain['count'];
        let pages = Math.ceil(items / onpage);

        if (page > pages)
            page = 1;

        let pager = {
            'path': '?',
            'count': items,
            'pages': pages,
            'page': page,
            'onpage': onpage,
            'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
            'nearRight': (page + 2 > pages) ? pages : page + 2,
        };

        res.render('explorer/index', { title: 'Blocks', chain: chain, pager: pager });
    });

    router.get('/records/:addr/:dataset?', function (req, res, next) {

        if (!/^[a-z0-9]{10,130}$/.test(req.params.addr)) {
            throw new Error('Invalid database name');
        }

        let dataset = req.params.dataset;
        let onpage = 100;
        let page = parseInt(req.query.page);
        if (!page)
            page = 1;

        let offset = onpage * (page - 1);
        let params = [];

        if (dataset)
            params = [req.params.addr, req.params.dataset, onpage, offset];
        else
            params = [req.params.addr];

        let result = app.rpc.handlers.records(params);
        let db = result[1];
        if (result[0])
            throw new Error(result[0]);

        let items = db['count'];
        let pages = Math.ceil(items / onpage);

        if (page > pages)
            page = 1;

        db['pager'] = {
            'path': '?',
            'count': db.count,
            'pages': pages,
            'page': page,
            'onpage': onpage,
            'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
            'nearRight': (page + 2 > pages) ? pages : page + 2,
        };

        res.render('explorer/records', { title: 'Database records', db: db });

    });

    router.get('/peers', function (req, res, next) {

        let result = app.rpc.handlers.peers([]);
        let list = result[1];
        if (result[0])
            throw new Error(result[0]);

        res.render('explorer/peers', { title: 'Connected peers', peers: list });
    });

    router.get('/mempool', function (req, res, next) {

        let result = app.rpc.handlers.mempool([]);
        let list = result[1];
        if (result[0])
            throw new Error(result[0]);

        res.render('explorer/mempool', { title: 'Mempool', list: list });
    });

    router.get('/token/:ticker', function (req, res, next) {

        let onpage = 100;
        let page = parseInt(req.query.page) || 1;
        let offset = onpage * (page - 1);

        let d = app.rpc.handlers.tokenHistory([req.params.ticker, onpage, offset]);
        let token = d[1];

        if (d[0])
            throw new Error(d[0]);

        let items = token.count;
        let pages = Math.ceil(items / onpage);

        if (page > pages)
            page = 1;

        token.pager = {
            'path': '?',
            'count': token.count,
            'pages': pages,
            'page': page,
            'onpage': onpage,
            'nearLeft': ((page - 2) < 1) ? 1 : page - 2,
            'nearRight': (page + 2 > pages) ? pages : page + 2,
        }

        let tokenInfo = app.orwell.dsIndex.getTokenSettings(req.params.ticker);
        tokenInfo.address = app.orwell.getTokenAddress(req.params.ticker);
        tokenInfo.holders = app.orwell.dsIndex.getTokenHolders(req.params.ticker);

        let balance = {};
        for (let i in tokenInfo.holders) {
            balance[tokenInfo.holders[i]] = app.orwell.dsIndex.getTokenBalance(req.params.ticker, tokenInfo.holders[i]);
        }

        let tokenInitial = app.orwell.dsIndex.get('token/systemdata/' + req.params.ticker);
        tokenInfo.holders = balance;
        tokenInfo.initial = {};
        tokenInfo.initial.tx = tokenInitial.tx;
        tokenInfo.initial.writer = tokenInitial.writer;
        tokenInfo.initial.writerAddress = tokenInitial.writerAddress;

        res.render('explorer/token', { title: 'Token '+req.params.ticker, token: token, tokenInfo });
    });

    router.get('/rounds', function (req, res, next) {

        let result = app.rpc.handlers.consensus();
        let list = result[1];
        if (result[0])
            throw new Error(result[0]);
            
        res.render('explorer/rounds', { title: 'Consensus rounds', result: list, top: app.orwell.index.get('top') });
    });

    return router;
};
