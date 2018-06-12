/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

let net = require('net');
let split = require('split');

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
            stream.setNoDelay(false);
            stream.setKeepAlive(true);

            let st = stream.pipe(split(this.separator()));
            this.app.emit("net.connection", stream)
            this.app.emit("net.connection.add", stream, 'server');

            st.on("data", (data) => {
                data = this.separator() + data;
                this.serverBuffer += data;

                let res = this.processData('server');
                for (let i in res) {
                    this.app.emit("net.message", stream, res[i], 'server');
                }
            });

            st.on('close', () => {
                this.app.emit("net.close", st, 'close');
                if (st && st.remoteAddress)
                    this.app.emit("net.connection.remove", st.remoteAddress + "/" + st.remotePort + "/" + st.localPort, 'server');
            })

            st.on("end", () => {
                this.app.emit("net.close", st, 'end');
                if (st && st.remoteAddress)
                    this.app.emit("net.connection.remove", st.remoteAddress + "/" + st.remotePort + "/" + st.localPort, 'server');
            })

            st.on('error', (e) => {
                this.app.emit("net.error", e, st);
                if (st && st.remoteAddress)
                    this.app.emit("net.connection.remove", st.remoteAddress + "/" + st.remotePort + "/" + st.localPort, 'server');
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

        //this.newClient('localhost', this.port());
        return server;
    }
    newClient(host, port) {

        let client = net.connect(port, host);
        this.clientBuffer = "";
        let st = client.pipe(split(this.separator()));
        st.on('data', (data) => {
            data = this.separator() + data;
            this.clientBuffer += data;
            let res = this.processData('client');
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