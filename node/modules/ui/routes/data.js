const express = require('express');

module.exports = (app) => {

    const router = express.Router();

    router.get('/domains', function (req, res, next) {


        let domain = {};
        let q = req.query.q;
        let domains = [];

        if (q) {

            let key = app.orwell.getDomainInfo(q);
            domain.key = key;
            domain.domain = q;
            if (key)
                domain.registered = true;

        } else
            domains = app.orwell.getDomainsList();

        res.render('data/domains', { domains, q, domain, title: 'Seach domain' });
    });

    router.get('/domain/create', function (req, res, next) {

        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].domain = app.orwell.getKeyDomain(list[i].publicKey);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        res.render('data/domaincreate', { title: 'Create new domain', addressess: list });
    });

    router.post('/domain/create', function (req, res, next) {
        let from = req.body.from;
        let account = req.body.account;
        let domain = req.body.domain;

        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].domain = app.orwell.getKeyDomain(list[i].publicKey);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        let data = { from, account, domain }

        let obj = app.wallet.getAccount(from);
        if (!obj) {
            res.render('data/domaincreate', { title: 'Send coins', data, addressess: list, error: 'invalid account address' });
            return;
        }

        let domainAccount = app.wallet.getAccount(account);
        if (!domainAccount) {
            res.render('data/domaincreate', { title: 'Send coins', data, addressess: list, error: 'invalid domain account address' });
            return;
        }

        if (!domain || domain.length < 3 || !app.orwell.ADDRESS.isValidDomain(domain)) {
            res.render('data/domaincreate', { title: 'Send coins', data, addressess: list, error: 'invalid domain' });
            return;
        }

        let am = app.wallet.getBalance(from) / app.cnf("consensus").satoshi;
        if (am <= 0.01) {
            res.render('data/domaincreate', { title: 'Send coins', data, addressess: list, error: 'Account send from do not have balance (must be at least 0.01)' });
            return;
        }

        app.orwell.createDomain(obj, domain, domainAccount.publicKey)
            .then((result) => {
                console.log('success', result)
                res.redirect('/explorer/tx/' + result);
            })
            .catch((err) => {
                console.log('err', err, err.tx)
                console.log('send error', err)
                if (typeof err == 'string')
                    res.redirect('/explorer/tx/' + err);
                else
                    res.render('data/domaincreate', { title: 'Send coins', data, addressess: list, error: err });
            })


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
        console.log(d);
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

        res.render('data/tokens', { title: 'Tokens', tokens: tokenslist });
    });

    router.get('/token/create', function (req, res, next) {

        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        res.render('data/tokencreate', { title: 'Create new token or stock', addressess: list });
    });

    router.post('/token/create', function (req, res, next) {
        let from = req.body.from;
        let account = req.body.account;
        let ticker = req.body.ticker;
        let title = req.body.title;
        let emission = req.body.emission;
        let isStock = req.body.isStock;
        let share = isStock ? req.body.share : 0;

        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].domain = app.orwell.getKeyDomain(list[i].publicKey);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        let data = { from, account, ticker, title, emission, isStock, share }
        let obj = app.wallet.getAccount(from);

        if (!obj) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'invalid account address' });
            return;
        }

        let acc = app.wallet.getAccount(account);
        if (!acc) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'invalid token account address' });
            return;
        }

        let am = app.wallet.getBalance(from) / app.cnf("consensus").satoshi;
        if (am <= 0.01) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'Account send from do not have balance (must be at least 0.01)' });
            return;
        }

        if (app.orwell.getTokenTicker(acc.address)) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'Account from already have attached token' });
            return;
        }

        if (!ticker || app.orwell.getTokenAddress(ticker)) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'This ticker already exist' });
            return;
        }

        if (!title) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'Title is required' });
            return;
        }

        if (isStock && (share < 0 || share > 1)) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'Share must be in bounds' });
            return;
        }

        if (emission < 1000 || emission > 100000000) {
            res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: 'Emission must be in bounds' });
            return;
        }

        app.orwell.createToken(obj, acc, ticker, {
            title,
            emission,
            isStock,
            share,
        })
            .then((hashes) => {
                console.log('hashes', hashes);
                res.redirect('/explorer/tx/' + hashes);
            })
            .catch(e => {
                if (typeof e == 'string')
                    res.redirect('/explorer/tx/' + e);
                else
                    res.render('data/tokencreate', { title: 'Create token', data, addressess: list, error: e.message });
            })

    });
    //

    router.get('/token/send', function (req, res, next) {

        let selectedToken = req.query.token;

        let tokens = app.orwell.getTokenList();
        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        res.render('data/tokensend', { title: 'Send token or stock', addressess: list, tokens, data: { token: selectedToken } });
    });

    router.post('/token/balance', (req, res, next) => {

        let ticker = req.body.ticker;
        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.orwell.getTokenAddressAmount(ticker, list[i].address);
        }

        res.send({ ticker, list });
    })

    router.post('/token/send', function (req, res, next) {
        let account = req.body.account;
        let to = req.body.to;
        let tokenTicker = req.body.token;
        let amount = req.body.amount;

        let list = app.wallet.getAccounts();
        for (let i in list) {
            list[i].balance = app.wallet.getBalance(list[i].name);
            list[i].balanceToken = app.orwell.getTokenAddressAmount(tokenTicker, list[i].address);
            list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
        }

        let tokens = app.orwell.getTokenList();
        let data = { account, to, token: tokenTicker, amount }
        let obj = app.wallet.getAccount(account);

        if (!obj) {
            res.render('data/tokensend', { title: 'Send token', data, addressess: list, tokens, error: 'invalid account address' });
            return;
        }

        let am = app.wallet.getBalance(account) / app.cnf("consensus").satoshi;
        console.log('acc', account, am, data);
        if (am <= 0.001) {
            res.render('data/tokensend', { title: 'Send token', data, addressess: list, tokens, error: 'Account send from do not have balance (must be at least 0.01)' });
            return;
        }

        let tokenBalance = app.orwell.getTokenAddressAmount(tokenTicker, obj.address);
        if (tokenBalance < amount || amount <= 0) {
            res.render('data/tokensend', { title: 'Send token', data, addressess: list, tokens, error: 'Amount is not valid' });
            return;
        }

        if (!app.orwell.ADDRESS.isValidAddress(to)) {
            res.render('data/tokensend', { title: 'Send token', data, addressess: list, tokens, error: 'Address to is not valid' });
            return;
        }

        app.orwell.sendToken(tokenTicker, obj, to, amount)
            .then((hash) => {
                console.log('hashes', hash);
                res.redirect('/explorer/tx/' + hash);
            })
            .catch(e => {
                console.log(e);
                if (typeof e == 'string')
                    res.redirect('/explorer/tx/' + e);
                else
                    res.render('data/tokensend', { title: 'Send token', data, addressess: list, tokens, error: e.message || e.error });
            })

    });


    return router;
};
