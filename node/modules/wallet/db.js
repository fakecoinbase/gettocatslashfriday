/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
let fs = require('fs');

module.exports = (app) => {
    class WalletDB extends app.storage.Entity {
        constructor() {
            super(app, 'wallet', 'wallet');
            this.init();
        }

    }

    return WalletDB;
}