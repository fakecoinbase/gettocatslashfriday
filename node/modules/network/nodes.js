/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
let obj = null;
let nodes = function (app) {
    this.app = app;
    this.name = 'nodes';
    this.data = {};
}

nodes.prototype.get = function (key) {
    return this.data[key] || {};
}

nodes.prototype.set = function (key, value) {
    return this.data[key] = value;
}

nodes.prototype.getState = function (rinfo) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    return d.state || '';
}

nodes.prototype.setState = function (rinfo, newState) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    let oldState = d.state || '';
    this.app.debug("info", "network", "change node {" + key + "} state " + oldState + " -> " + newState)
    this.app.emit("app.network.node.changeState", { state: newState, old: oldState });
    d.state = newState;
    this.set("data/" + key, d);
}

nodes.prototype.updateRecvTime = function (rinfo) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    var temp = d.lastRecv || 0
    d.lastRecv = new Date().getTime() / 1000;
    d.lastMsg = d.lastRecv - temp;
    d.pingTime = d.lastRecv - d.lastSend
    if (d.pingTime < d.minPing)
        d.minPing = d.pingTime;
    this.set("data/" + key, d);
}

nodes.prototype.updateSendTime = function (rinfo) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    d.lastSend = new Date().getTime() / 1000;
    d.pingTime = d.lastSend - d.lastRecv
    if (d.pingTime < d.minPing)
        d.minPing = d.pingTime;
    this.set("data/" + key, d);
}

nodes.prototype.getLastMsg = function (key) {

    var d = this.get("data/" + key);
    return d.lastMsg || 0;

}

nodes.prototype.updateSentBytes = function (rinfo, bytes) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    if (!d.sentBytes)
        d.sentBytes = 0;
    d.sentBytes += bytes;
    this.set("data/" + key, d);
}

nodes.prototype.updateRecvBytes = function (rinfo, bytes) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    if (!d.recvBytes)
        d.recvBytes = 0;
    d.recvBytes += bytes;
    this.set("data/" + key, d);
}

nodes.prototype.remove = function (key) {
    delete this.data[key];
}

module.exports = nodes;