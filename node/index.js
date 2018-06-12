const { inherits } = require('util')
const EventEmitter = require('events');
const path = require('path');
const appError = require('./error').createAppError;

class app extends EventEmitter {
    constructor(config, modules) {
        super();

        if (!config)
            config = {};

        this.fisReadySended = false;
        this.appstate = '';
        this.prevappstate = '';
        this.miningstate = '';
        this.syncstate = '';

        this.loadModule('config');
        this.loadConfig(config);
        //load system modules
        this.loadToolset('crypto');
        this.loadToolset('tools');
        this.loadModule('db');

        if (modules)
            this.loadModules(modules);
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
    init(modules) {

        if (!modules)
            modules = this.cnf('modules');

        this.loadModules(modules);
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
        for (let i in arr) {
            if (arr[i] instanceof Array)
                this.loadModule(arr[i][0], arr[i][1])
            else
                this.loadModule(arr[i])
        }

        this.emit("init");
    }
    loadModule(name, modulepath) {
        let filepath = path.resolve(name);
        if (!modulepath) {
            filepath = "./modules/" + name;
        } else {
            filepath = modulepath;
        }

        let cls = require(filepath + '/index');
        this[name] = new cls(this, name);
        if (this[name].init instanceof Function && this.isTestInstanceForModule(name))
            this[name].init();
        this.debug('info', name, 'loaded');
        this.emit("module.loaded", {
            module: name,
            object: this[name]
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
    }
    loadConfig(optionsOrFile) {
        this.debug("info", "config", 'load config file')
        this.emit("config.load", optionsOrFile);
    }
    cnf(argument) {
        return argument ? this.config.arg[argument] : this.config.arg;
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

module.exports = app;