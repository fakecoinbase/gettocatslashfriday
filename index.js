const fs = require('fs');
let DAPP = require("./node/index");

//some static modules for future maybe

DAPP.initConfig = (path) => {
    let def_cnf = {
        "network": "",
        "test": {
        },
        "main": {
        }
    };

    let firstRun = false;
    let crypto = require('./node/modules/crypto/index')
    //if config is not exist or no have "node" key in selected network - add "node" value
    try {
        if (fs.existsSync(path)) {
            let json = JSON.parse(fs.readFileSync(path).toString('utf8'));
            
            if (!json['main']['node'] || !json['main']['node']['privateKey']) {
                let keystore = crypto.createKeyPair();
                json['main']['node'] = {
                    privateKey: keystore.private,
                    publicKey: keystore.publicKey
                };
            }

            if (!json['test']['node'] || !json['test']['node']['privateKey']) {
                firstRun = true;
                let keystore = crypto.createKeyPair();
                json['test']['node'] = {
                    privateKey: keystore.private,
                    publicKey: keystore.publicKey
                };
            }

            //if have only privateKey?
            //generate public!
            if (!json['main']['node']['publicKey'] && json['main']['node']['privateKey']) {
                firstRun = true;//i think its first run too.
                json['main']['node']['publicKey'] = crypto.getPublicByPrivate(json['main']['node']['privateKey']);
            }

            if (!json['test']['node']['publicKey'] && json['test']['node']['privateKey']) {
                firstRun = true;//i think its first run too.
                json['test']['node']['publicKey'] = crypto.getPublicByPrivate(json['test']['node']['privateKey']);
            }

            fs.writeFileSync(path, JSON.stringify(json, null, ' '));
        } else
            throw new Error('not found');
    } catch (err) {
        
        let keystore = crypto.createKeyPair();
        def_cnf['test']['node'] = {
            privateKey: keystore.private,
            publicKey: keystore.public
        };

        let keystore2 = crypto.createKeyPair();
        def_cnf['main']['node'] = {
            privateKey: keystore2.private,
            publicKey: keystore2.public
        };

        fs.writeFileSync(path, JSON.stringify(def_cnf, null, ' '));
        firstRun = true;
    }

    return firstRun;
}

DAPP.create = (configFile, network) => {
    let firstRun = DAPP.initConfig(configFile);//preinstall config before first run
    return new DAPP(require(configFile), network, firstRun);
}

module.exports = DAPP;
