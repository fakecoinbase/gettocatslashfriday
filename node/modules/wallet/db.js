/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
let fs = require('fs');
let obj = null;
let wallet = function (app) {
    this.app = app;
    this.file = 'keystore.json';
    this.name = 'wallet';
    this.data = {};
    this.load();
}

wallet.prototype.get = function (key) {
    return this.data[key] || {};
}

wallet.prototype.set = function (key, value) {
    this.data[key] = value;
    this.save();
    return value;
}

wallet.prototype.remove = function (key) {
    delete this.data[key];
    this.save();
}


wallet.prototype.load = function () {
    let data = {};
    let path = this.app.config.getLocalHomePath() + "/" + this.file;
    try {
         data = JSON.parse(fs.readFileSync(path));
    } catch (e) {
        fs.openSync(path, 'w');
    }
    this.data = data;
}

wallet.prototype.save = function () {
    fs.writeFileSync(this.app.config.getLocalHomePath() + "/" + this.file, JSON.stringify(this.data || {}));
}

wallet.prototype.list = function() {
    return this.data;
}

module.exports = wallet;