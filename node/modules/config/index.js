const fs = require('fs');

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
        let config = require(file);
        for (let i in config) {
            this.arg[i] = config[i];
        }
    }
    loadOptions(options) {
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

        if (this.app.cnf('debug').fs)
            this.app.debug('info', 'config', 'save to file: ' + pathToConfig, JSON.stringify(this.app.cnf()));
        fs.writeFileSync(pathToConfig, JSON.stringify(this.app.cnf()));
    }

}

module.exports = config;