const EventEmitter = require('events');
const path = require('path');
const appError = require('./error').createAppError;

class app extends EventEmitter {
    constructor(config, network) {
        super();

        if (!network)
            network = 'main';

        if (!config)
            config = {};

        this.cwd = "./";
        if (config.cwd)
            this.cwd = config.cwd + "/node/";

        config.network = network;
        this.network = network;
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
    //skip settings and modules for start 2 or more instances, must invoke before init()
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
            if (this[name].init instanceof Function)
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
    getDefaultConfig() {
        return {
            "port": 19841,
            "magic": "aa3a2b2f",
            "nodes": [
                "127.0.0.1//19841"
            ],
            "modules": [
                "storage",
                "rpc",
                "orwell",
                "wallet",
                "networkhandler",
                "network",
                "ui",
                "dapps",
                "validatormanager"
            ],
            "consensus": {
                "version": 1,
                "protocol_version": 1,
                "extends": "ddpos",
                "ignorePrevChilds": true,
                "shareStake": 0.3,
                "delegates": [
                    "02a832289414cc0a402022beb17f8432c3fed3c3187036bb83e359917df26b8b56",
                    "03032f0fa03e1e6ec9dac5e84055bffbb99d57abd6de1e48741f0aa2471d72cd76"
                ],
                "timeout": 60,
                "pause": 30,
                "validatorCount": 60,
                "staticDelegatesLimit": 2,
                "changeBranchDelay": 1,
                "blockSize": 1e7,
                "nopeerstimeout": 15000,
                "satoshi": 1e8,
                "maxcoins": 20e6,
                "masternodeAmount": 1000,
                "emission": {
                    "0": 50,
                    "1-190": 100,
                    "191-199,height": 13500,
                    "200": 15000,
                    "201-10000": 5,
                    "10001-110000": 60,
                    "110001-210000": 30,
                    "210001-410000": 15,
                    "410001-1010000": 10
                },
                "syncmax": 200,
                "maturity": 100,
                "minfeeperbyte": 1,
                "genesisMode": false,
                "blockversion": 1,
                "txversion": 1,
                "validationalert": true
            },
            "genesis": {
                "v": 1,
                "p": "0000000000000000000000000000000000000000000000000000000000000000",
                "m": "4d6a58da73ae39cb8df89294842e4c622ccde1fab2c51d812be926534524d6f4",
                "t": 1587129074,
                "b": 0,
                "n": 0,
                "tx": [
                    {
                        "v": 1,
                        "s": [
                            [
                                "3046022100c09dbfb69349e1bca3673bfe97acb3f897da66a8eca1811de33a0f243853e19802210097385f7f85a9a43f37dfdfc0093c8fb685798b445bc9c6e2f76e027f8ce778f1",
                                "02a832289414cc0a402022beb17f8432c3fed3c3187036bb83e359917df26b8b56"
                            ]
                        ],
                        "out": [
                            {
                                "address": "oKiuEwim7Cqwo9zaxCcHaQYPiunz2iM5Ac",
                                "amount": 4750000000,
                                "key": "02a832289414cc0a402022beb17f8432c3fed3c3187036bb83e359917df26b8b56"
                            },
                            {
                                "address": "oHpESURCzrSQae4fWL9ZDtVa4sR6aLqm23",
                                "amount": 250000000,
                                "key": "03032f0fa03e1e6ec9dac5e84055bffbb99d57abd6de1e48741f0aa2471d72cd76"
                            }
                        ],
                        "cb": "001122",
                        "m": "b4ee9b6114d25fef5df065d1852819bc5ffe6927c779fe25107d6f1239574f44",
                        "k": "02a832289414cc0a402022beb17f8432c3fed3c3187036bb83e359917df26b8b56"
                    }
                ],
                "hash": "9a7068d4d9c9fa46ca770980400164997702c904194e958b353cd8c5842e1d69"
            },
            "rpc": {
                "useServer": true,
                "server": {
                    "port": 41991,
                    "host": "127.0.0.1",
                    "path": "/",
                    "strict": false,
                    "ssl": null
                }
            },
            "orwelldb": {
                "path": "%home%/orwelldb/",
                "systemAddress": "oKiuEwim7Cqwo9zaxCcHaQYPiunz2iM5Ac",
                "systemKey": "02a832289414cc0a402022beb17f8432c3fed3c3187036bb83e359917df26b8b56"
            },
            "wallet": {
                "changeAddress": false,
                "operationfee": {
                    "create": 1e6,
                    "write": 10,
                    "settings": 100
                }
            },
            "ui": {
                "port": "3000",
                "host": "127.0.0.1"
            },
            "dapps": {
                "http": "80",
                "http.timeout": 60000,
            }
        }
    }
    getAgentName() {
        return {
            "name": "fridayjs",
            "version": 0.1
        }
    }
}


app.cli = require('./cli.js');
module.exports = app;