class network {
    constructor(app) {
        this.app = app;
        this.p2p = null;
        this.protocol = null;
        this.reconnects = [];
        this.node = {};
        this.inited = false;

    }
    init() {

        return new Promise((resolve, reject) => {

            this.separator = () => { return this.app.cnf(this.app.cnf('network')).magic };
            this.port = () => { return this.app.cnf(this.app.cnf('network')).port };
            const NODES = require('./nodes')(this.app);
            this.nodes = new NODES();
            let cls = require('./p2p');
            this.p2p = new cls(this.app);
            let cls2 = require('./protocol');
            this.protocol = new cls2(this.app, this.nodes)
            //nodes
            this.app.debug('info', 'network', 'setting up network eventlisteners')
            this.setUp();
            this.app.debug('info', 'network', 'initialize server')
            this.initServer()
                .then(() => {
                    this.app.debug('info', 'network', 'initialize client')
                    this.initClient();
                    this.inited = true;
                    resolve();
                });
        });

    }
    setUp() {
        if (this.inited)
            return;
        this.app.on("net.connection.add", (socket, from) => {
            let o = {
                remoteAddress: socket.remoteAddress.replace("::ffff:", ""),
                remotePort: socket.remotePort,
                localAddress: socket.localAddress.replace("::ffff:", ""),
                port: socket.localPort
            }

            let addr = this.protocol.getAddressUniq(o)
            this.app.debug('info', 'network', "add peer " + addr, from);

            let list = this.nodes.get("connections");
            if (!list || !(list instanceof Array))
                list = [];

            let finded = false;
            for (let i in list) {
                if (list[i] && list[i] == addr) {
                    finded = true;
                    break;
                }
            }

            if (!finded) {
                list.push(addr);
                this.nodes.set("connections", list);
            }
            //connection new event
            socket.STATUS = 1;
            this.nodes.set("connection/" + addr, socket);
            this.app.emit("net.node.add", addr);
        });

        this.app.on("net.connection.remove", (addr, from) => {

            this.app.debug('info', 'network', "remove peer " + addr, from);

            let socket = this.nodes.get("connection/" + addr);

            if (socket && socket.destroyed !== true)
                return;

            var list = this.nodes.get("connections");
            if (!list || !(list instanceof Array))
                list = [];
            if (list.indexOf(addr) >= 0) {
                list.splice(list.indexOf(addr), 1);
                this.nodes.set("connections", list);
            }

            try {
                var d = this.nodes.get("data/" + addr);
                if (d.socket)
                    d.socket.destroy();
            } catch (e) {
                console.log('net error', e)
            }

            this.nodes.remove("connection/" + addr);
            this.nodes.remove('address/' + addr);
            this.nodes.remove('data/' + addr);
            try {
                this.app.removeAllListeners("net.node.init" + addr)
            } catch (e) {

            };
        })

        this.app.on("net.node.add", (addr, afterInit) => {
            this.__addNode(addr, (client) => {

                let rinfo = {
                    remoteAddress: client.remoteAddress,
                    remotePort: client.localPort,
                    port: client.remotePort
                };

                if (afterInit instanceof Function)
                    afterInit(rinfo);

                let d = this.protocol.nodes.get("data/" + this.protocol.getAddressUniq(rinfo));
                d.initiator = 1;
                this.protocol.nodes.set("data/" + this.protocol.getAddressUniq(rinfo), d);

                this.protocol.sendOne(rinfo, 'version', {
                    version: this.app.cnf('consensus').version || 0,
                    lastblock: this.app.orwell.index.getTop(),
                    agent: this.protocol.getUserAgent(),
                    nodekey: this.protocol.getNodeKey(),
                    timezone: 0//offset UTC
                }, true)

            });

        });

        this.app.on("net.message", (socket, data, from) => {


            if (!data)
                return false;


            function isSelf(address) {
                var os = require('os');
                var finded = false;
                var interfaces = os.networkInterfaces();
                var addresses = [];

                for (var k in interfaces) {
                    for (var k2 in interfaces[k]) {
                        var addr = interfaces[k][k2];
                        if (addr.family === 'IPv4') {
                            addresses.push(addr.address);
                            if (addr.address == address || addr.address == address.replace("::ffff:", ""))
                                finded = true;
                        }
                    }
                }


                return address == '127.0.0.1' || address == '::ffff:127.0.0.1' || finded
            }

            if (!socket.remoteAddress)
                return;
            let rinfo;

            if (from == 'server')
                rinfo = { remoteAddress: socket.remoteAddress, remotePort: socket.remotePort, port: socket.localPort };
            else
                rinfo = { remoteAddress: socket.remoteAddress, remotePort: socket.localPort, port: socket.remotePort };

            this.nodes.updateRecvBytes(rinfo, new Buffer(data).length);

            //DECRYPT MESSAGE
            let d = {};
            try {
                d = this.parseTransportLayer(data);
            } catch (e) {
                this.app.debug('error', 'network', "can not parse message from " + rinfo.remoteAddress, e.message);
                return false;
            }
            //parse layer 1
            //decrypt (if need)


            var nodeKey = this.protocol.handleMessage(d, rinfo, isSelf(socket.remoteAddress));
        });

        this.app.on("net.error", function (e) {
            var showed = 0;
            if (e.code === 'EADDRINUSE') {
                console.log('Address in use, retrying...');
                showed = 1
            }

            if (e.code === 'ECONNRESET') {
                console.log(e.code + " " + e.remoteAddress + ":" + e.port);
                showed = 1;
            }

            if (e.code == 'ECONNREFUSED') {
                showed = 1;
            }

            if (!showed)
                console.log(e)
        })

        this.app.on("net.send", (message, rinfo, isFirstMessage) => {

            this.protocol.checkNodes();
            let nlist = this.protocol.getNodeList();
            let msg = message;

            try {
                if (!rinfo)
                    for (let k in nlist) {
                        let rinf = this.protocol.getUniqAddress(nlist[k]);
                        this.nodes.updateSendTime(rinf)
                        this.nodes.updateSentBytes(rinf, msg.length)
                        this.__send(nlist[k], msg, isFirstMessage)
                    }
                else {
                    this.nodes.updateSendTime(rinfo)
                    this.nodes.updateSentBytes(rinfo, msg.length)
                    this.__send(this.protocol.getAddressUniq(rinfo), msg, isFirstMessage);
                }
            } catch (e) {
                this.app.emit("net.error", e);
            }


        })

    }
    initClient() {
        if (this.inited)
            return;
        this.app.debug('info', 'network', 'init nodes')
        this.protocol.init();
    }
    initServer() {
        if (this.inited)
            return;

        let promise = new Promise((resolve) => {

            this.app.on("net.server.init", () => {
                this.app.debug("info", 'network', 'server inited');
                resolve();
            });

        });

        this.p2p.serve();
        return promise;
    }
    __addNode(addr, cb) {
        var a = this.protocol.getUniqAddress(addr);
        if (!a.remoteAddress)
            return;//cant do here noting
        if (!a.port)
            a.port = this.port();
        var socket = this.nodes.get("connection/" + addr);
        if (!socket || !socket.STATUS || socket.destroyed === true) {

            //remove old connection
            this.app.emit("net.connection.remove", addr);
            this.p2p.newClient(a.remoteAddress, a.port, (client) => {
                this.app.emit("net.connection.add", client, 'client');
                //this.app.emit("net.node.init" + this.app.network.protocol.getAddressUniq(client));
                cb(client);


                var reconnect = () => {

                    if (!this.reconnects[addr])
                        this.reconnects[addr] = 0;
                    else
                        this.reconnects[addr]++;

                    if (this.reconnects[addr] < 5)
                        setTimeout(() => {
                            this.protocol.addNode(addr, function () {

                                this.reconnects[addr] = 0;

                                if (this.app.cnf('debug').peer)
                                    this.app.debug('warn', 'network', "client " + addr + " reconnected");
                            })
                        }, this.app.tools.rand(30, 90));

                };

                client.on("close", reconnect)
                client.on("end", reconnect)

            });

        } else {
            cb(socket)
        }

    }
    encryptMessage(msg, addr, isFirstMessage) {
        let encryptedBuffer = new Buffer("");
        if (!isFirstMessage) {
            let nodeinfo = this.nodes.get("data/" + addr);
            //ENCRYPT MESSAGE
            let publicKey = nodeinfo.nodekey;
            if (!publicKey)
                throw new Error('can not find node public key ' + addr);
            //create ecdh X | publicKey, keystore -> X
            let X = this.app.crypto.createECDHsecret(publicKey, this.app.cnf('node'));
            //encrypt value with | X, value -> encvalue
            encryptedBuffer = this.app.crypto.encryptECDH(msg, X);
        } else {
            encryptedBuffer = msg;
        }

        return encryptedBuffer;
    }
    decryptMessage(buffer, addr, isEncrypted) {
        if (!isEncrypted) {
            return buffer;
        } else {
            let nodeinfo = this.nodes.get("data/" + addr);
            let publicKey = nodeinfo.nodekey;
            let X = this.app.crypto.createECDHsecret(publicKey, this.app.cnf('node'));
            return this.app.crypto.decryptECDH(buffer, X);
        }
    }
    buildTransportLayer(payload, isEncrypted) {
        let w = new this.app.tools.bitPony.writer(new Buffer(""));
        let sign = this.app.crypto.sha256(this.app.crypto.sha256(payload)).slice(0, 4);

        w.uint32(parseInt(this.separator(), 16), true);
        w.uint8(isEncrypted ? 1 : 0, true);
        w.var_int(payload.length, true);
        w.uint32(parseInt(sign.toString('hex'), 16), true);
        w.char(payload, true);

        return w.getBuffer();
    }
    parseTransportLayer(buffer) {
        let d = {};
        let r = new this.app.tools.bitPony.reader(new Buffer(buffer, 'hex'));

        let res = r.uint32(0);
        d.magic = parseInt(res.result).toString(16);
        res = r.uint8(res.offset);
        d.encFlag = res.result;

        res = r.var_int(res.offset);
        d.payloadlength = res.result;

        res = r.uint32(res.offset);
        d.checksum = new Buffer(this.app.tools.bitPony.tool.numHex(res.result), 'hex').toString('hex');
        let osum = this.app.tools.bitPony.tool.numHex(res.result);

        if (d.checksum.length == 6)
            d.checksum = "00" + d.checksum;

        if (d.checksum.length == 4)
            d.checksum = "0000" + d.checksum;

        if (d.checksum.length == 2)
            d.checksum = "000000" + d.checksum;

        res = r.char(d.payloadlength, res.offset);
        d.payload = res.result;

        let sum = this.app.tools.bitPony.tool.sha256(this.app.tools.bitPony.tool.sha256(d.payload)).slice(0, 4);

        if (d.payloadlength != d.payload.length)
            throw new Error('invalid size of payload ' + d.payloadlength + ' - ' + d.payload.length);

        if (sum.toString('hex') != d.checksum) {
            console.log("orig checksum", osum, "new checksum", d.checksum, "after: ", d.checksum, "diff:", sum);
            throw new Error(' invalid checksum ' + sum.toString('hex') + " - " + d.checksum);
        }
        if (d.magic != this.separator())
            throw new Error('invalid separator ' + parseInt(d.magic).toString(16) + " - " + this.separator());

        return d;
    }
    __send(addr, msg, isFirstMessage) {

        let encryptedBuffer;
        try {
            encryptedBuffer = this.encryptMessage(msg, addr, isFirstMessage);
        } catch (e) {
            this.app.debug('network', 'error', ' can not find node public key, maybe node is not inited? ' + addr)
            return false;
        }
        msg = this.buildTransportLayer(encryptedBuffer, !isFirstMessage);
        let sendmessage = function (msg, socket) {
            socket.write(msg, function () {
            });
        }

        let socket = this.nodes.get("connection/" + addr);
        if (!socket.STATUS || socket.destroyed === true) {
            this.protocol.addNode(addr, (rinfo) => {
                sendmessage(msg, this.nodes.get("connection/" + this.protocol.getAddressUniq(rinfo)));
            })
        } else
            try {
                sendmessage(msg, socket);
            } catch (e) {
                this.protocol.addNode(addr, (rinfo) => {
                    sendmessage(msg, this.nodes.get("connection/" + this.protocol.getAddressUniq(rinfo)));
                })
            }
    }
}

module.exports = network;