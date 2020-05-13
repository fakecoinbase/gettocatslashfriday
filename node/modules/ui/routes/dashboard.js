const express = require('express');

module.exports = (app)=>{

    const router = express.Router();

    /* GET users listing. */
    router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
    });


    return router;
};
