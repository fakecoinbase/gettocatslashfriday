const { inherits } = require('util')
const EventEmitter = require('events');
const path = require('path');
const appError = require('./error').createAppError;

class app extends EventEmitter {
    constructor(config) {
        super();

        if (!config)
            config = {};

        this.cwd = "./";
        if (config.cwd)
            this.cwd = config.cwd + "/node/";

        this.f_noconflict = false;
        this.fisReadySended = false;
        this.appstate = '';
        this.prevappstate = '';
        this.miningstate = '';
        this.syncstate = '';
        this.skiplist = [];

        process.on('unhandledRejection', (reason, p) => {
            console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        });

        this.loadModule('config')
            .then(() => {
                this.loadConfig(config);

                //load system modules
                return Promise.all([
                    this.loadToolset('crypto'),
                    this.loadToolset('tools'),
                    this.loadModule('db'),
                ])
            })
            .then(() => {
                this.emit("_caninit");
            })

    }
    debug(level, module_name, text) {

        var arr = [
        ];
        for (var i in arguments) {
            if (i < 2)
                continue
            arr.push(arguments[i]);
        }

        this.emit("app.debug", {
            level: level,
            module: module_name,
            text: arr,
        });
    }
    skipModules(skiplist) {
        this.skiplist = skiplist;
    }
    //skil settings and modules for start 2 or more instances, must invoke before init()
    noConflict(cb) {
        this.f_noconflict = cb;
    }
    init(modules) {

        return new Promise((res) => {

            this.on("_caninit", () => {
                if (!modules)
                    modules = this.cnf('modules');

                if (this.f_noconflict instanceof Function)
                    this.f_noconflict.apply(this, ['beforeload']);

                return this.loadModules(modules)
                    .then((results) => {
                        this.debug('info', "app", 'loaded all modules; sending init event');

                        if (this.f_noconflict instanceof Function)
                            this.f_noconflict.apply(this, ['beforeinit']);

                        this.emit("init", results);
                        res(results);
                    })
                    .catch((e) => {
                        throw e;
                    })
            })

        });

    }
    throwErrorByCode(module, code) {
        let err = this[module]['errors'][code];
        this.throwError(err[1], err[0], err[2]);
    }
    throwError(message, code, details) {
        throw (
            appError({
                message: message,
                extendedInfo: details || "",
                code: code,
            })
        );
    }
    loadModules(arr) {

        let prevState = false;
        for (let i = 0; i < arr.length; i++) {
            if (this.skiplist.indexOf(arr[i]) >= 0)
                continue;
            if (arr[i] instanceof Array)
                prevState = this.loadModule(arr[i][0], arr[i][1], prevState)
            else
                prevState = this.loadModule(arr[i], false, prevState)
        }

        return prevState;
    }
    loadModule(name, modulepath, prevState) {
        let filepath = path.resolve(name);
        if (!modulepath) {
            filepath = this.cwd + "modules/" + name;
        } else {
            filepath = modulepath;
        }

        if (!(prevState instanceof Promise))
            prevState = Promise.resolve();

        let rs = prevState.then(() => {
            let res = null;
            let cls = require(filepath + '/index');
            this[name] = new cls(this, name);
            if (this[name].init instanceof Function && this.isTestInstanceForModule(name))
                res = this[name].init();

            let rs;
            if (res instanceof Promise)
                rs = res;
            else
                rs = Promise.resolve(res);

            return rs;
        });

        return rs.then((RES) => {
            this.debug('info', name, 'loaded');
            this.emit("module.loaded", {
                module: name,
                object: this[name]
            });

            return Promise.resolve(RES);
        });
    }
    loadToolset(name, modulepath) {
        let filepath = path.resolve(name);
        if (!modulepath) {
            filepath = "./modules/" + name;
        } else {
            filepath = modulepath;
        }

        this[name] = require(filepath + '/index');
        if (this[name].init instanceof Function)
            this[name].init(this);
        this.debug('info', name, 'loaded');
        this.emit("module.loaded", {
            module: name,
            object: this[name],
            toolset: true,//static library (no object with constructor, just set of some tool-functions)
        });

        return Promise.resolve(this[name]);
    }
    loadConfig(optionsOrFile) {
        this.debug("info", "config", 'load config file')
        this.emit("config.load", optionsOrFile);
    }
    cnf(argument) {

        if (argument && argument != this.config.arg.network) {
            if (['tests', 'network', 'agent'].indexOf(argument) >= 0)
                return this.config.arg[argument];
            else
                return this.config.arg[this.config.arg.network][argument];
        } else if (argument && argument == this.config.arg.network)
            return this.config.arg[this.config.arg.network];//get network settings only

        return this.config.arg;//get all config
    }
    isTestInstanceForModule(moduleName) {

        if (moduleName == 'config')
            return true;

        let list = this.cnf('tests');
        let finded = false;
        if (list.length > 0) {
            for (let k in list) {
                if (list[k] == moduleName)
                    finded = true;
            }

            return finded;
        }

        return true;
    }
    setSyncState(newState) {
        let oldState = this.syncstate;
        this.syncstate = newState;
        this.emit("app.state.sync", { state: this.syncstate, old: oldState });
        this.debug('info', 'app', 'change sync state ' + oldState + ' -> ' + this.syncstate);
    }
    getSyncState() {
        return this.syncstate;
    }
    setMiningState(newState) {
        let oldState = this.miningstate;
        this.miningstate = newState;
        this.emit("app.state.mining", { state: this.miningstate, old: oldState });
        this.debug('info', 'app', 'change mining state ' + oldState + ' -> ' + this.miningstate);
    }
    getMiningState() { return this.miningstate }
    setAppState(newState) {
        this.prevappstate = this.appstate;
        this.appstate = newState;
        if (newState == 'ready' && !this.fisReadySended)
            this.fisReadySended = true;
        this.emit("app.state.app", { state: this.appstate, old: this.prevappstate });
        this.debug('info', 'app', 'change app state ' + this.prevappstate + ' -> ' + this.appstate);
    }
    getAppState() { return this.appstate }
    getPrevAppState() { return this.prevappstate; }
    isReadySended() { return this.fisReadySended }
    connect(peers) {
        for (let i in peers) {
            this.network.protocol.initNode(peers[i].split(":").join("//"));
        }
    }
    send(fromKeystoreOrAccountName, ToPublicKeyHex, valueBuffer) {
        return this.chain.sendEncryptedData(ToPublicKeyHex, valueBuffer, fromKeystoreOrAccountName);
    }
}


app.cli = require('./cli.js');
module.exports = app;