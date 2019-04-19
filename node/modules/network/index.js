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

            this.inited = true;
            this.separator = () => { return this.app.cnf(this.app.cnf('network')).magic };
            this.port = () => { return this.app.cnf(this.app.cnf('network')).port };
            const NODES = require('./nodes');
            this.nodes = new NODES(this.app);
            let cls = require('./p2p');
            this.p2p = new cls(this.app);
            let cls2 = require('./protocol');
            this.protocol = new cls2(this.app, this.nodes)
            //nodes
            this.app.debug('info', 'network', 'setting up network eventlisteners')
            this.setUp();
            this.app.debug('info', 'network', 'initialize server')
            this.initServer();
            this.app.debug('info', 'network', 'initialize client')
            this.initClient();

            resolve();

        });

    }
    setUp() {
        if (!this.inited)
            return;
        this.app.on("net.connection.add", (socket, from) => {

            var o = {}
            if (from != 'server')
                o = {
                    remoteAddress: socket.remoteAddress.replace("::ffff:", ""),
                    remotePort: socket.localPort,
                    localAddress: socket.localAddress.replace("::ffff:", ""),
                    port: socket.remotePort
                };
            else
                o = {
                    remoteAddress: socket.remoteAddress.replace("::ffff:", ""),
                    remotePort: socket.remotePort,
                    localAddress: socket.localAddress.replace("::ffff:", ""),
                    port: socket.localPort
                }

            var addr = this.protocol.getAddressUniq(o)
            this.app.debug('info', 'network', "add seed " + addr, from);

            var list = this.nodes.get("connections");
            if (!list || !(list instanceof Array))
                list = [];

            var finded = false;
            for (var i in list) {
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
            this.app.emit("net.connection.new", addr, socket);
            this.nodes.set("connection/" + addr, socket);
        });

        this.app.on("net.connection.remove", (addr, from) => {

            this.app.debug('info', 'network', "remove seed " + addr, from);

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

        })

        this.app.on("net.node.add", (addr, cb) => {

            this.__addNode(addr, function (client) {

                cb({
                    remoteAddress: client.remoteAddress,
                    remotePort: client.localPort,
                    port: client.remotePort
                })

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
            if (from == 'server')
                var rinfo = { remoteAddress: socket.remoteAddress, remotePort: socket.remotePort, port: socket.localPort };
            else
                var rinfo = { remoteAddress: socket.remoteAddress, remotePort: socket.localPort, port: socket.remotePort };


            this.nodes.updateRecvBytes(rinfo, new Buffer(data).length)
            var nodeKey = this.protocol.handleMessage(data, rinfo, isSelf(socket.remoteAddress));
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

        this.app.on("net.send", (message, rinfo) => {

            this.protocol.checkNodes();
            let nlist = this.protocol.getNodeList();

            if (!(message instanceof Array))
                message = [message];
            for (let i in message) {
                setTimeout((i) => {
                    let msg = Buffer.concat([
                        message[i],
                        new Buffer(this.separator(), 'hex')
                    ]);

                    try {
                        if (!rinfo)
                            for (let k in nlist) {
                                let rinf = this.protocol.getUniqAddress(nlist[k]);
                                this.nodes.updateSendTime(rinf)
                                this.nodes.updateSentBytes(rinf, msg.length)
                                this.__send(nlist[k], msg.toString('hex'))
                            }
                        else {
                            this.nodes.updateSendTime(rinfo)
                            this.nodes.updateSentBytes(rinfo, msg.length)
                            this.__send(this.protocol.getAddressUniq(rinfo), msg.toString('hex'));
                        }
                    } catch (e) {
                        this.app.emit("net.error", e);
                    }
                }, 100 * i, i)

            }


        })

    }
    initClient() {
        if (!this.inited)
            return;
        this.app.debug('info', 'network', 'init nodes')
        this.protocol.init();
    }
    initServer() {
        if (!this.inited)
            return;
        this.p2p.serve();
    }
    __addNode(addr, cb) {
        var a = this.protocol.getUniqAddress(addr);
        if (!a.remoteAddress)
            return;//cant do here noting
        if (!a.port)
            a.port = this.port();
        var socket = this.nodes.get("connection/" + addr);
        if (!socket.STATUS || socket.destroyed === true) {

            //remove old connection
            this.app.emit("net.connection.remove", addr);
            var client = this.p2p.newClient(a.remoteAddress, a.port);

            client.on("connect", () => {
                this.app.emit("net.connection", client);
                this.app.emit("net.connection.add", client);
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



        } else
            cb(socket)

    }
    __send(addr, msg) {
        var sendmessage = function (msg, socket) {
            socket.write(msg, function () {
            });
        }

        var socket = this.nodes.get("connection/" + addr);
        if (!socket.STATUS || socket.destroyed === true)
            this.protocol.addNode(addr, (rinfo) => {
                sendmessage(msg, this.nodes.get("connection/" + this.protocol.getAddressUniq(rinfo)));
            })
        else
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