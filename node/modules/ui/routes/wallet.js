const express = require('express');

module.exports = (app) => {

  const router = express.Router();

  //list
  //create

  router.get('/', function (req, res, next) {
    let list = app.wallet.getAccounts();
    for (let i in list) {
      list[i].balance = app.wallet.getBalance(list[i].name);
      list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
    }
    res.render('wallet/index', { title: 'Address list', list: list });
  });

  router.post('/create', function (req, res, next) {

    let name = req.body.name;
    if (!name)
      res.redirect('/wallet');

    let obj = app.wallet.findAddrByAccount(name);
    if (obj)
      res.redirect('/wallet/account/' + obj.hash);
    else {
      obj = app.wallet.createAccount(name);
      res.redirect('/wallet/account/' + obj.hash);
    }
  });

  router.get('/account/:acc', function (req, res, next) {

    let limit = parseInt(req.query.limit), offset = parseInt(req.query.offset);
    if (!Number.isFinite(offset) || isNaN(offset))
      offset = 0;

    if (!limit || !Number.isFinite(limit) || isNaN(limit))
      limit = 100;

    if (limit > 1000)
      limit = 1000;

    let id = 0;
    if (req.params.acc)
      id = req.params.acc;

    let obj = app.wallet.getAccount(id);

    if (!obj)
      throw new Error('account ' + id + ' not found');

    let list = app.orwell.utxo.getUTXOHistory(obj.address, limit, offset);
    res.render('wallet/account', { title: 'Account', account: obj, utxoIndex: list });
  });

  /* GET users listing. */
  router.get('/send', function (req, res, next) {

    let list = app.wallet.getAccounts();
    for (let i in list) {
      list[i].balance = app.wallet.getBalance(list[i].name);
      list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
    }

    res.render('wallet/send', { title: 'Send coins', addressess: list });
  });

  router.post('/send', function (req, res, next) {
    let from = req.body.from;
    let to = req.body.to;
    let amount = req.body.amount;

    let list = app.wallet.getAccounts();
    for (let i in list) {
      list[i].balance = app.wallet.getBalance(list[i].name);
      list[i].balancehr = app.wallet.getBalance(list[i].name) / app.cnf("consensus").satoshi;
    }

    let data = { from, to, amount }

    let obj = app.wallet.getAccount(from);
    if (!obj) {
      res.render('wallet/send', { title: 'Send coins', data, addressess: list, error: 'invalid address from' });
      return;
    }

    if (amount <= 0 || amount > 21000000) {
      res.render('wallet/send', { title: 'Send coins', data, addressess: list, error: 'invalid amount' });
      return;
    }

    let am = app.wallet.getBalance(from) / app.cnf("consensus").satoshi;

    if (am <= 0){
      res.render('wallet/send', { title: 'Send coins', data, addressess: list, error: 'Do not have balance' });
      return;
    }

    if (amount > am){
      res.render('wallet/send', { title: 'Send coins', data, addressess: list, error: 'Amount bigger then balance' });
      return;
    }

    if (!app.orwell.ADDRESS.isValidAddress(to)){
      res.render('wallet/send', { title: 'Send coins', data, addressess: list, error: 'Invalid address to' });
      return;
    }

    app.wallet.sendFromAddress(obj.address, to, amount * app.cnf('consensus').satoshi)
      .then((result) => {
        console.log('success',result, result.tx)
        res.redirect('/explorer/tx/' + result.hash);
      })
      .catch((err) => {
        console.log('err',err, err.tx)
        console.log('send error', err)
        if (typeof err == 'string')
          res.redirect('/explorer/tx/' + err);
        else
          res.render('wallet/send', { title: 'Send coins', data, addressess: list, error: err });
      })


  });

  return router;
};
