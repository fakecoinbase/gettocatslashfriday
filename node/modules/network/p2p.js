/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

let net = require('net');

class p2p {

    constructor(app) {
        this.serverBuffer = "";
        this.clientBuffer = "";
        this.app = app;
        //now we can change network onfly.
        this.separator = () => { return this.app.cnf(this.app.cnf('network')).magic };
        this.port = () => { return this.app.cnf(this.app.cnf('network')).port };
    }
    serve() {

        let server = net.createServer({ allowHalfOpen: false }, (stream) => {
            this.serverBuffer = "";
            stream.setNoDelay(true);
            stream.setKeepAlive(true);

            let delay = 25;//can not be less then 25ms, because of process.nextTick function algorithm.
            //let st = stream.pipe(split(this.separator()));
            if (stream.remoteAddress.replace("::ffff:", "") == '127.0.0.1')
                delay = 1000;//becase local server event can come before client event, for right algorithm working we must fix it.  

            setTimeout(() => {
                this.app.emit("net.connection", stream)
                this.app.emit("net.connection.add", stream, 'server');
                this.app.emit("net.node.init" + this.app.network.protocol.getAddressUniq(stream));
            }, delay);

            stream.on("data", (data) => {
                this.serverBuffer += data.toString('hex');
                let res = this.readBuffer('server');
                for (let i in res) {
                    this.app.emit("net.message", stream, res[i]);
                }
            });

            stream.on('close', () => {
                this.app.emit("net.close", stream, 'close');
                if (stream && stream.remoteAddress)
                    this.app.emit("net.connection.remove", stream.remoteAddress + "/" + stream.remotePort + "/" + stream.localPort, 'server');
            })

            stream.on("end", () => {
                this.app.emit("net.close", stream, 'end');
                if (stream && stream.remoteAddress)
                    this.app.emit("net.connection.remove", stream.remoteAddress + "/" + stream.remotePort + "/" + stream.localPort, 'server');
            })

            stream.on('error', (e) => {
                this.app.emit("net.error", e, stream);
                if (stream && stream.remoteAddress)
                    this.app.emit("net.connection.remove", stream.remoteAddress + "/" + stream.remotePort + "/" + stream.localPort, 'server');
            })

        }).listen(this.port());

        server.on('listening', () => {
            this.app.emit("net.server.init", server);
        });

        server.on('close', () => {
            this.app.emit("net.server.close", server, 'close');
        })

        server.on("end", () => {
            this.app.emit("net.server.close", server, 'end');
        })

        server.on('error', (e) => {
            this.app.emit("net.server.error", e, server);
        })

        return server;
    }
    newClient(host, port, onConnect) {
        let client = net.connect(port, host, () => {
            if (onConnect && onConnect instanceof Function)
                onConnect(client);
        });
        client.setNoDelay(true);
        this.clientBuffer = "";
        client.on('data', (data) => {
            this.clientBuffer += data.toString('hex');
            let res = this.readBuffer('client');

            for (let i in res) {
                this.app.emit("net.message", client, res[i]);
            }
        });

        client.on('close', () => {
            this.app.emit("net.close", client);
        })

        client.on('error', (e) => {
            this.app.emit("net.error", e, client);
        })

        client.on("end", () => {
            this.app.emit("net.close", client, 'end');
        })

        return client;

    }
    readBuffer(key) {
        let keyValue = key == 'client' ? 'clientBuffer' : 'serverBuffer';
        let buffer = this[keyValue];
        let parts = buffer.split(this.separator());
        let finished = [], unfinished = [];
        for (let i in parts) {
            if (!parts[i])
                continue;

            let part = parts[i];
            let res = this.checkBuffer(part);
            if (res) {
                finished.push(new Buffer(part, 'hex'));
            } else {
                unfinished.unshift(part);
            }
        }

        if (unfinished > 1) {
            throw new Error('unfinished must be only one.');
        }

        if (unfinished[0])
            this[keyValue] = unfinished[0];
        else
            this[keyValue] = "";
        return finished;
    }
    checkBuffer(buffer) {
        try {
            this.app.network.parseTransportLayer(buffer);
            return true;
        } catch (e) {
            console.log('invalid message', e.message, e.message == "Attempt to write outside buffer bounds" ? e : "");
            return false;
        }
    }
    processData(key) {

        let keyValue = key == 'client' ? 'clientBuffer' : 'serverBuffer';
        let res = this[keyValue].split(this.separator());
        if (res.length == 1) {
            //its part of previous message
            return res;
        }

        let result = [], cnt = 0
        for (let i in res) {
            if (i == 0 && res[i] != '') {
                result.push(res[i]);
            } else if (res[i] && res[i].length > 0) {
                let r = this.separator() + res[i];
                result.push(r);
                cnt++;
            }
        }

        this[keyValue] = "";
        return result;

    }
}

module.exports = p2p