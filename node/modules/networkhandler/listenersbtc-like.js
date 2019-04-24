module.exports = function (app) {

    app.on("handler.version", function (message, connectionInfo, selfMessage) {

        let key = "data/" + app.network.protocol.getAddressUniq(connectionInfo);
        let d = app.network.nodes.get(key);
        d.startPing = Date.now();
        app.network.nodes.set(key, {
            key: message.nodekey,
            initiator: d.initiator,
            rinfo: connectionInfo,
            top: message.lastblock || { number: 0 },
            ackSended: 1,
            conntime: Date.now() / 1000,
            agent: app.network.protocol.getUserAgent(),
            timezone: message.timezone
        });

        if (selfMessage) {
            app.emit("app.network.inited");
            //return false;
        }

        app.network.nodes.set('address/' + app.network.protocol.getAddressUniq(connectionInfo), message.nodekey);

        if (!d.initiator) {
            app.network.protocol.sendOne(connectionInfo, 'version', {
                version: app.cnf('consensus').version || 0,
                lastblock: app.btcchain.index.get('top'),
                nodekey: app.network.protocol.getNodeKey(),
                agent: app.network.protocol.getUserAgent(),
                timezone: 0
            });

            app.network.protocol.sendOne(connectionInfo, 'verack', {});
            return;
        }

        app.network.protocol.sendOne(connectionInfo, 'verack', {});
    });

    app.on("handler.verack", function (message, connectionInfo, selfMessage) {

        //if (selfMessage)
        //return false;


        var key = app.network.protocol.getAddressUniq(connectionInfo);
        var d = app.network.nodes.get("data/" + key);
        d.rinfo = connectionInfo;
        d.ackSended = 1;
        d.inited = 1;
        //d.lastMsg = Date.now() / 1000;
        d.pingTime = Date.now() / 1000 - d.startPing;
        if (d.pingTime < d.minPing)
            d.minPing = d.pingTime;
        delete d.startPing;
        app.network.nodes.set("data/" + key, d);
        app.network.nodes.set('address/' + key, d.nodeKey);

        app.emit("net.node.init" + key, key)
        app.emit("protocol.node.added", key, app.network.protocol.getUniqAddress(key), selfMessage)

        var arr = [], isActiveNode = true;
        if (app.btcchain.index.get('top').height > d.top.height) {

            arr.push({
                sendBack: true,
                type: 'needupdate',
                response: {
                    lastblock: app.btcchain.index.get('top'),
                    known: app.btcchain.getKnownRange(),
                }
            })
        } else if (d.top.height > app.btcchain.index.get('top').height) {
            isActiveNode = false;

            arr.push({
                sendBack: true,
                type: 'getdata',
                response: {
                    type: 'blocks',
                    hashStart: app.btcchain.index.getTop().hash,
                    hashStop: 0,
                    offset: 0,
                }
            })
        }

        if (app.getSyncState() == 'readyToSync' && isActiveNode && !selfMessage)
            app.emit("app.chain.sync", { status: 'success' });

        if (app.getSyncState() == 'active' && !isActiveNode && !selfMessage)
            app.emit("app.chain.sync", { status: 'resync' });

        if (d.top.height == app.btcchain.index.get('top').height) {
            app.network.nodes.setState(connectionInfo, 'synced');
        }

        arr.push({
            sendBack: true,
            type: 'activenodes',
            response: {
                addr: connectionInfo.remoteAddress.replace("::ffff:", ""),
                nodes: app.network.protocol.exceptNode(connectionInfo.remoteAddress.replace("::ffff:", ""))
            }
        });

        for (let i in arr) {
            app.network.protocol.sendOne(connectionInfo, arr[i].type, arr[i].response);
        }

    });

    app.on("handler.activenodes", function (message, connectionInfo, selfMessage) {
        if (message.addr)
            app.network.node.addr = message.addr.replace("::ffff:", "");

        if (selfMessage)
            return false;

        for (let i in message.nodes) {
            app.network.protocol.addNode(message.nodes[i]);
        }

        app.network.protocol.sendOne(connectionInfo, 'ping', {
            latest: app.btcchain.index.get('top'),
        });
    });

    app.on("handler.ping", function (message, connectionInfo, selfMessage) {

        if (selfMessage)
            return false;

        let key = app.network.protocol.getAddressUniq(connectionInfo);
        let d = app.network.nodes.get("data/" + key);
        d.top = message.latest;
        app.network.nodes.set("data/" + key, d);

        let isActiveNode = true;
        if (app.btcchain.index.get('top').height > message.latest.height) {

            if (app.getSyncState() == 'readyToSync')
                app.emit("app.chain.sync", { status: 'success' });

            app.network.protocol.sendOne(connectionInfo, 'needupdate', {
                lastblock: app.btcchain.index.get('top'),
                known: app.btcchain.getKnownRange(),
            });
        } else if (message.latest.height > app.btcchain.index.get('top').height) {
            isActiveNode = false;
            app.network.protocol.sendOne(connectionInfo, 'getdata', {
                type: 'blocks',
                hashStart: app.btcchain.index.getTop().hash,
                hashStop: 0,
                offset: 0,
            });
        }

        if (message.latest.height == app.btcchain.index.get('top').height) {
            app.network.nodes.setState(connectionInfo, 'synced');
        }

        if (app.getSyncState() == 'readyToSync' && isActiveNode && !selfMessage)
            app.emit("app.chain.sync", { status: 'success' });

        if (app.getSyncState() == 'active' && !isActiveNode && !selfMessage)
            app.emit("app.chain.sync", { status: 'resync' });

        app.network.protocol.sendOne(connectionInfo, 'pong', {});
    });

    app.on("handler.pong", function (message, connectionInfo, selfMessage) {

        if (selfMessage)
            return false;

        var key = "data/" + app.network.protocol.getAddressUniq(connectionInfo);
        var d = app.network.nodes.get(key);

        d.pingTime = new Date().getTime() / 1000 - d.startPing;
        if (d.pingTime < d.minPing)
            d.minPing = d.pingTime;
        delete d.startPing;
        app.network.nodes.set(key, d)

    });

    app.on("app.state.latest", function (newState) {
        console.log('new state', newState)
    });

    app.on("app.state", function (data) {

        if (data.state == 'readyToSync' && data.old == 'loadFromCache') {
            //send now state to all connected nodes
            app.network.protocol.sendAll('getdata', {
                type: 'blocks',
                hashStart: app.btcchain.index.getTop().hash,
                hashStop: 0,
                offset: 0,
            });
        }

        if (data.state == 'active' && data.old == 'readyToSync') {
            //synced
            //app.miner.start();
        }

        if (data.old == 'active' && data.state != 'active') {
            //app.miner.stop();
        }

    });

    app.on("handler.getdata", function (message, connectionInfo, selfMessage) {

        if (selfMessage)
            return false;

        if (app.getSyncState() != 'active')
            return;

        if (message.type == 'blocks') {

            if (app.network.nodes.getState(connectionInfo) == 'syncing')
                return;

            let top = app.btcchain.index.getTop();

            let startIndex = 0;
            let stopIndex = top.height;
            let offsetIndex = 0;
            let sendOffset = 0;

            startIndex = app.btcchain.index.get("block/" + message.hashStart).height;
            if (message.hashStop)
                stopIndex = app.btcchain.index.get("block/" + message.hashStop).height;

            if (stopIndex - startIndex > app.cnf("consensus").syncmax) {
                sendOffset = 1;
                offsetIndex = startIndex + app.cnf("consensus").syncmax;
            } else
                offsetIndex = stopIndex;

            let range = [startIndex, offsetIndex];

            let first = range[0];
            let last = range[1];
            if (last < 0)
                last = 0;

            if (app.btcchain.index.getTop().hash == message.hashStart)
                return;//nothing todo here

            app.network.nodes.setState(connectionInfo, 'syncing');
            let list = app.btcchain.getBlockList(last, first);

            //start send range
            app.network.protocol.sendOne(connectionInfo, 'blocksync', {
                'type': 'start',
                'hash': list[0].hash + list[list.length - 1].hash
            });

            for (let i in list) {
                app.network.protocol.sendOne(connectionInfo, 'block', list[i]);
            }

            //end send range 
            app.network.protocol.sendOne(connectionInfo, 'blocksync', {
                'type': 'finish',
                'hash': list[0].hash + list[list.length - 1].hash,
                'hasNext': sendOffset,
            });

            app.network.nodes.setState(connectionInfo, 'synced');

        }

        if (message.type == 'mempool') {

            let list = app.btcchain.getMemPool();

            for (let i in list) {
                app.network.protocol.sendOne(connectionInfo, 'mempool.tx', list[i]);
            }
        }

        if (message.type == 'blockdata'){
            let block = app.btcchain.getBlock(message.hash);
            app.network.protocol.sendOne(connectionInfo, 'block', block);
        }

    });

    app.on("handler.blocksync", function (message, connectionInfo, selfMessage) {

        if (selfMessage)
            return false;

        if (message.type == 'start') {
            app.network.nodes.setState(connectionInfo, 'syncer');
            app.db.set("sync/" + message.hash, []);
            app.db.set("activesync", message.hash);
        }

        if (message.type == 'finish') {
            app.network.nodes.setState(connectionInfo, 'synced');
            let blocklist = app.db.get("sync/" + message.hash);
            let activesync = app.db.get("activesync");
            //add blocks to blockchain

            for (let i in blocklist) {
                try {
                    app.btcchain.addBlock(blocklist[i], 'sync', { isWindowFirst: i == 0, syncNum: i });
                } catch (e) {
                    app.debug("error", "info", e.message);
                }
            }

            //sort blockpool by number
            app.db.remove("sync/" + message.hash);
            app.db.remove("activesync");

            //call next offset, if have offset param
            if (message.hasNext) {
                app.network.protocol.sendOne(connectionInfo, 'getdata', {
                    type: 'blocks',
                    hashStart: app.btcchain.index.getTop().hash,
                    hashStop: 0,
                    offset: 0,
                });
            } else {
                //or call mempool set
                app.network.protocol.sendOne(connectionInfo, 'getdata', {
                    type: 'mempool'
                });

                app.setSyncState("active");
            }

        }

    });

    app.on("handler.block", function (message, connectionInfo, selfMessage) {

        let activesync = app.db.get("activesync");
        if (activesync && !app.tools.emptyObject(activesync)) {
            if (selfMessage)
                return false;

            let blocklist = app.db.get("sync/" + activesync);
            blocklist.push(message);
            app.db.set("sync/" + activesync, blocklist);
        } else {
            try {
                app.debug('info', 'btcchain', message.height + "/" + message.hash);
                app.btcchain.addBlock(message, 'relay', {}, function (b, _, inMainNet) {
                    app.debug("info", "btcchain", "added new block by rpc ", b.hash, b.validation_errors.length, b.validation_errors);
                    if (b.validation_errors.length == 0) {
                        b.send();
                    }
                });
            } catch (e) {
                if (e.code == 'alreadyexist')
                    app.debug('warning', 'chain', 'double adding block', e.message);
                else
                    app.debug('error', 'chain', 'block rejected: ', e.code, e.message);
            }
        }

    });

    app.on("handler.mempool.tx", function (message, connectionInfo, selfMessage) {
        //if (selfMessage)
        //    return false;
        let errcode = '', errmsg = '';
        let invalid = false;
        try {
            if (app.btcchain.addToMemPool(message, app.getSyncState() == 'active' ? 'mempool' : 'sync')) {
                //emit for all
                if (app.getSyncState() == 'active')
                    app.emit("app.chain.mempooltx", { tx: message });

                if (app.getSyncState() == 'active')
                    app.btcchain.sendTx(message);
            } else
                invalid = true;
        } catch (e) {
            errcode = e.code;
            invalid = true;
            errmsg = e.message;
            app.debug('error', 'chain', 'transaction error: ' + errcode, errmsg)
        }

        if (invalid && app.getSyncState() == 'active') {
            if (errcode != 'alreadyexist') {
                app.debug('error', 'chain', 'transaction is rejected: ' + errcode, errmsg)
                app.network.protocol.sendOne(connectionInfo, 'reject', {
                    type: 'tx',
                    hash: message.hash,
                    code: errcode,
                });
            }
        }
    });

    app.on("handler.state", function (message, connectionInfo, selfMessage) {
        if (selfMessage)
            return false;
        let errcode = '', errmsg = '';
        let invalid = false;
        try {
            if (app.state.updateState(message)) {
                //TODO: emit for all if new
                //if (app.getSyncState() == 'active')
                //app.chain.sendTx(message);
            } else
                invalid = true;
        } catch (e) {
            errcode = e.code;
            invalid = true;
            errmsg = e.message;
        }

        if (invalid && app.getSyncState() == 'active') {
            //todo: reject state if new and invalid
            app.debug('error', 'chain', 'state is rejected: ' + errcode, errmsg)
            /*app.network.protocol.sendOne(connectionInfo, 'reject', {
                type: 'tx',
                hash: message.hash,
                code: errcode,
            });*/
        }
    });

    app.on("handler.needupdate", function (message, connectionInfo, selfMessage) {
        if (selfMessage)
            return false;

        app.setSyncState('readyToSync');

        //this node have less number block then in 
        app.network.protocol.sendAll('getdata', {
            type: 'blocks',
            hashStart: app.btcchain.index.getTop().hash,
            hashStop: 0,
            offset: 0,
        });

    });

    app.on("app.network.inited", function () {

        /*let list = app.wallet.getAllPublicKeys();
        for (let i in list) {
            app.wallet.addDataListener(list[i]);
        }*/

        //inited local peer
        //if dont have another peer after 60 minutes - ready with haventpeer event
        //havent peers emitted
        setTimeout(() => {
            app.emit("haventpeer");
        }, app.cnf('consensus').nopeerstimeout);

    });

    app.on("protocol.node.added", (connectionKey, connectionInfo, selfMessage) => {
        if (!selfMessage)
            app.emit("atleastonepeer");
    })

    app.on("app.chain.latest", function () {

        if (app.getSyncState() == 'active') {
            /* setTimeout(function () {
                 if (app.getAppState() != 'idle' && app.getAppState() != '')
             }, app.tools.rand(3000, 7000));*/
        }

    });

    app.on("app.chain.mempooltx", (tx) => {
        //if (app.getAppState() != 'idle' && app.getAppState() != '')
    })

    app.on("app.chain.sync", function (data) {

        if (data.status == 'success') {
            app.setSyncState('active');
        }

        if (data.status == 'resync') {
            app.setSyncState('readyForSync');
        }

    });

    app.on("atleastonepeer", () => {
        //ready will be emitting when inited and connected at least 1 node 

        if (app.getAppState() != 'ready' && !app.isReadySended()) {
            app.debug("info", "app", "1 peer connected")
            app.setAppState('ready');
            app.emit("preready", { event: 'atleastonepeer' });
        }
    });

    app.on("haventpeer", () => {
        //OR ready will be emitted when dont have peers after N minutes after start

        if (app.getAppState() != 'ready' && !app.isReadySended()) {
            app.debug("info", "app", "havent connected peers")
            app.setAppState('ready');
            app.emit("preready", { event: 'haventpeer' });
        }
    });

    app.on("preready", (data) => {
        app.debug("info", "app", "ready for work with event", data.event)
        if (data.event == 'haventpeer' && app.getSyncState() != 'active')
            app.setSyncState('active');

        app.emit("ready", { event: data.event });
    });

    app.on("idle", () => {
        app.debug('info', 'app', 'idle app');
        app.setAppState('idle');
    });

    app.on("unidle", () => {
        app.debug('info', 'app', 'unidle app');
        app.setAppState(app.getPrevAppState());
        //if (app.getAppState() == 'ready' && app.isReadySended())
    });

    app.on("chain.block.seek", (data) => {
        app.network.protocol.sendOne(connectionInfo, 'getdata', {
            type: 'blockdata',
            hash: data.hash
        });
    });

}