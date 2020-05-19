const express = require('express');

module.exports = (app) => {

  const router = express.Router();

  /* GET users listing. */
  router.get('/', function (req, res, next) {
    //TODO:
    //uptime
    //connections
    //net stats (sent/recv)
    //earned (if validator or have delegateAmount)
    //some another info?
    //res.render('index', { title: 'Dashboard' });

    res.redirect('/explorer');
  });


  return router;
};
