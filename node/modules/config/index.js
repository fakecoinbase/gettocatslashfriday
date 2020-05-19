const fs = require('fs');
const mixin = require('mixin-deep');
const prompt = require('prompt');

class config {
    constructor(app) {
        this.arg = [];
        this.app = app;
    }
    init() {
        this.app.on("config.load", (data) => {
            if (data instanceof String)
                this.loadFromFile(data)
            if (data instanceof Object)
                this.loadOptions(data);
        });
    }
    loadFromFile(file) {
        let options = require(file);

        let net = options['network'];
        let params = options[net];

        let res = mixin(this.app.getDefaultConfig(), params);
        //params = Object.assign({}, this.app.getDefaultConfig(), params);
        options[net] = res;

        for (let i in options) {
            this.arg[i] = options[i];
        }
    }
    loadOptions(options) {
        let net = options['network'];
        let params = options[net];
        let res = mixin(this.app.getDefaultConfig(), params);
        //params = Object.assign({}, this.app.getDefaultConfig(), params);
        options[net] = res;

        for (let i in options) {
            this.arg[i] = options[i];
        }
    }
    getLocalHomePath() {
        var homepath;
        if (process.platform == 'win32')
            homepath = process.env.APPDATA || process.env.USERPROFILE;
        else
            homepath = process.env.HOME;

        var dir = homepath + "/" + (process.platform == 'linux' ? "." : "") + (this.app.cnf('appname') || 'friday-node');
        this.initDir(dir);
        return dir;
    }
    initDir(path) {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    }
    saveConfig(pathToConfig) {
        if (!pathToConfig)
            pathToConfig = this.getLocalHomePath() + "/config.json";

        this.app.debug('info', 'config', 'save to file: ' + pathToConfig, JSON.stringify(this.app.cnf()));
        fs.writeFileSync(pathToConfig, JSON.stringify(this.app.cnf()));
    }
    createKeystorePassword() {
        //TODO: finish wallet encryption
        return new Promise((resolve, reject) => {

            let prevPasswordHash = this.arg.secret;

            console.log('This is first run of node application')
            console.log('You must set new password for keystore below:')

            prompt.start();

            let schema = {
                properties: {
                    password: {
                        description: 'Enter your password',
                        pattern: /^.+{6,}$/,
                        message: 'Password must be 6 or more symbols',
                        required: true,
                        replace: '*',
                    },
                    passwordRepeat: {
                        description: 'Repeat your password',
                        hidden: true,
                        replace: '*',
                    }
                }
            };

            prompt.get(schema, function (err, result) {
                try {
                    if (err)
                        throw new Error(err);

                    if (result.password != result.passwordRepeat)
                        throw new Error('password is not equal, cancel');


                    //if have old password: decrypt database with password


                    //encrypt db
                    //save secret to config
                    //end app
                    resolve();

                } catch (e) {
                    console.log('error: ', e.message);
                }

            });

        })

    }
}

module.exports = config;