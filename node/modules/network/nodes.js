/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
module.exports = (app) => {
    class Nodes extends app.storage.Index {
        constructor() {
            super(app, 'nodes', true);//only in memory
            this.init();
        }

        getState(rinfo) {
            let key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
            let d = this.get("data/" + key);
            return d.state || '';
        }

        setState(rinfo, newState) {
            let key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
            let d = this.get("data/" + key);
            let oldState = d.state || '';
            this.app.debug("info", "network", "change node {" + key + "} state " + oldState + " -> " + newState)
            this.app.emit("app.network.node.changeState", { state: newState, old: oldState });
            d.state = newState;
            this.set("data/" + key, d);
        }

        updateRecvTime(rinfo) {
            let key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
            let d = this.get("data/" + key);
            let temp = d.lastRecv || 0
            d.lastRecv = new Date().getTime() / 1000;
            d.lastMsg = d.lastRecv - temp;
            d.pingTime = d.lastRecv - d.lastSend
            if (d.pingTime < d.minPing)
                d.minPing = d.pingTime;
            this.set("data/" + key, d);
        }

        updateSendTime(rinfo) {
            let key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
            let d = this.get("data/" + key);
            d.lastSend = new Date().getTime() / 1000;
            d.pingTime = d.lastSend - d.lastRecv
            if (d.pingTime < d.minPing)
                d.minPing = d.pingTime;
            this.set("data/" + key, d);
        }

        getLastMsg(key) {
            let d = this.get("data/" + key);
            return d.lastMsg || 0;

        }

        updateSentBytes(rinfo, bytes) {
            let key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
            let d = this.get("data/" + key);
            if (!d.sentBytes)
                d.sentBytes = 0;
            d.sentBytes += bytes;
            this.set("data/" + key, d);
        }

        updateRecvBytes(rinfo, bytes) {
            let key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
            let d = this.get("data/" + key);
            if (!d.recvBytes)
                d.recvBytes = 0;
            d.recvBytes += bytes;
            this.set("data/" + key, d);
        }

        get(key) {
            let val = super.get(key);
            if (!val)
                val = {};
            return val;
        }
    }

    return Nodes;
}