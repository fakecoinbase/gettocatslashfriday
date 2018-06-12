/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
const fs = require('fs');

let obj = null;
let indexes = function (app) {
    this.name = 'indexes';
    this.app = app;
    this.data = {};
}

indexes.prototype.get = function (key) {
    return this.data[key] || {};
}

indexes.prototype.set = function (key, value) {
    return this.data[key] = value;
}

indexes.prototype.remove = function (key) {
    delete this.data[key];
}

indexes.prototype.load = function (file, toKey) {
    let data = {};

    let path = this.app.config.getLocalHomePath() + "/" + file;
    try {
        data = JSON.parse(fs.readFileSync(path));
    } catch (e) {
        fs.openSync(path, 'w');
    }

    this.data[toKey] = data;
}

indexes.prototype.save = function (key, file) {
    fs.writeFileSync(this.app.config.getLocalHomePath() + "/" + file, JSON.stringify(this.data[key] || {}));
}

module.exports = indexes;