const updns = require('updns');
const http = require('http');
const crypto = require('crypto');
const bitowl = require('bitowl');
const net = require('net');
const parser = require('parse-raw-http');

class dApps {
    constructor(app) {
        this.app = app;
        this.handlers = {};
        this.domains = [];
    }
    init() {

        for (let i in this.app.cnf('dapps').list) {
            let settings = this.app.cnf('dapps').list[i];

            let keystore = this.app.wallet.getAccount(i);
            if (!keystore)
                throw new Error('Account for dapp ' + i + ' is not found');

            this.handlers[keystore.publicKey] = i;
        }

        this.initDNSProxy();
        this.initProxy();
    }
    updateDomainsList(){
        return this.domains  = this.app.orwell.getDomainsList();
    }
    initDNSProxy() {
        this.app.debug('info', 'dapps', 'init dns server');
        let dns = updns.createServer(53, '127.0.0.1');
        

        dns.on('listening', server => {
            this.updateDomainsList();
            this.app.debug('info', 'dapps', 'DNS service has started')
        });

        //TODO: add new block listener and invoke updateBlocklist 

        dns.on('message', (domain, send, proxy) => {
            if (this.domains.indexOf(domain) != -1) {
                send('127.0.0.1')
            }

            if (domain == 'debug.node') {
                send('127.0.0.1')
            }
        })
    }
    initProxy() {
        //creates http server
        this.httpProxy = http.createServer((req, res) => {
            function toTitleCase(str) {
                return str.replace(/[a-z]*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
            }

            let body = '';

            req.on('data', (chunk) => {
                body += chunk;
            });

            req.on('end', () => {

                let rawRequest = [];
                rawRequest.push(req.method + ' ' + req.url + ' HTTP/' + req.httpVersion);

                for (let prop in req.headers) {
                    let val = req.headers[prop];
                    if (prop == 'User-Agent' || prop == 'user-agent')
                        val = this.getUserAgent();
                    rawRequest.push(toTitleCase(prop) + ': ' + val);
                }

                //later we change this line to special headers, like 
                //X: public key of client
                //S: sign raw data with this public key
                //U: unique request id

                rawRequest.push("---X---");
                rawRequest.push("---U---");
                rawRequest.push("---S---");

                if (body.length > 0) {
                    rawRequest.push("")
                    rawRequest.push(body);
                } else {
                    rawRequest.push("")
                }

                rawRequest.push("")
                this.app.debug('info', 'dApp/client', 'create request to ' + req.headers.host + ", ", req.method + ' ' + req.url);
                let host = req.headers.host.split(":");
                this.createBlockchainRequest(host[0], 'http', rawRequest.join("\n"))
                    .then((result) => {
                        //todo headers
                        this.app.debug('info', 'dApp/client', 'get response ' + req.url + " " + result.code + " ", result.statusMessage);

                        res.writeHead(result.code, result.headers);
                        res.end(result.body);
                    })
                    .catch(e => {
                        res.writeHead(500);
                        res.end(e.toString());
                    })
            });

            req.on('err', (err) => {
                console.error(err);
            });
        }).listen(this.app.cnf('dapps').http, () => {
            this.httpProxy.timeout = this.app.cnf('dapps')['http.timeout'];
            this.app.debug('info', 'dApps', 'Proxy http server listening on port ' + this.app.cnf('dapps').http);
        });
    }
    createBlockchainRequest(domain, type, rawRequest) {
        let receiver = this.app.orwell.getDomainAddress(domain);

        if (domain == 'debug.node')//debug
            receiver = '023a785294530b0d863e6bd060681d6d2bf8c6252ef6902f1e48a2bc4b7d894258';

        if (!receiver)
            throw new Error('Public key for domain ' + domain + ' is not found');

        //todo: get account for each site, if need, now only one for all:
        let account = this.app.cnf('dapp-client');
        let sender = account.publicKey;
        let requestId = crypto.randomBytes(16).toString('hex');
        rawRequest = rawRequest.split("---X---").join("Sender: " + sender);
        rawRequest = rawRequest.split("---U---").join("RequestId: " + requestId);

        /*let senderAddress = this.app.orwell.ADDRESS.generateAddressFromPublicKey(sender);
        rawRequest = rawRequest.split("---B---").join("CoinBalance: " + this.app.wallet.getBalanceAddress(senderAddress)/this.app.cnf('consensus').satoshi);
        let tokenaddress = this.app.orwell.ADDRESS.generateAddressFromPublicKey(receiver);
        //getTokenAddressAmount
        let tokenTicker = this.app.orwell.getTokenTicker(tokenaddress);
        let tokenBalance = this.app.orwell.getTokenAddressAmount(tokenTicker, senderAddress);
        rawRequest = rawRequest.split("---BT---").join("TokenBalance: " + tokenBalance);*/

        let signData = rawRequest.split("---S---").join("Sign:");
        let signature = this.app.crypto.sign(account.privateKey, this.app.orwell.hash(new Buffer(signData))).toString('hex');
        rawRequest = rawRequest.split("---S---").join("Sign: " + signature);
        //to check signature you must replace "<space>signature" from body to empty string and verify this buffer with public key of sender 
        //every site can by self check signature (if node->site have MIM attack)

        //encrypto rawRequest
        //generate message to receiver:
        //from|to|[requestDomain|requestType|requestBody]
        let request = bitowl.data.pack({
            requestId: requestId,
            requestDomain: domain,
            requestType: type,
            requestBody: rawRequest,
            requestSignature: signature
        });

        let X = this.app.crypto.createECDHsecret(receiver, account);
        let payload = this.app.crypto.encryptECDH(request, X);

        //send to blockchain
        this.app.network.protocol.sendAll('dappreq', {
            from: sender,
            to: receiver,
            payload: payload.toString('hex')
        });

        return new Promise((resolve, reject) => {
            //TODO: timeout error
            //receive response from blockchain
            this.app.on("dappres/" + requestId, (response) => {
                let { requestId, responseBody, responseSignature } = response;

                let codeArr = responseBody.split("\n")[0].split(" ");
                let httver = codeArr.shift();
                let code = codeArr.shift();
                let codeMessage = codeArr.join(' ').trim();

                let res;

                try {
                    res = parser.parseResponse.parseResponse(new Buffer(responseBody), {
                        decodeContentEncoding: true,
                    });
                } catch (e) {
                    let a = responseBody.split("\r\n\r\n");
                    let headersList = a.shift().split("\r\n");
                    headersList.shift();
                    let headers = {};
                    for (let h in headersList) {
                        let k = headersList[h].split(": ");
                        headers[k[0]] = k[1].trim();
                    }

                    let body = a.join("\r\n\r\n");

                    //get from cache
                    res = {
                        statusCode: code,
                        statusMessage: codeMessage,
                        headers,
                        bodyData: body
                    }
                }

                let headers = res.headers;
                headers['Sender'] = response.from;//server pubkey
                headers['Receiver'] = response.to;//client pubkey
                headers['Sign'] = responseSignature;

                resolve({
                    code: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers,
                    body: res.bodyData
                });

            });
            //parse, unencrypt, verify
            //send to promise
        })
    }
    getUserAgent() {
        let os = require('os');
        return "%agent%:%agent_ver%/%platform%/%os%"
            .replace("%agent%", this.app.getAgentName().name)
            .replace("%agent_ver%", this.app.getAgentName().version)
            .replace("%platform%", 'nodejs')
            .replace("%os%", os.platform())
    }

    //handling requests
    handleRequest(data) {
        //parse
        let { from, to, payload } = data;
        if (Object.keys(this.handlers).indexOf(to) == -1)
            return false;

        //unencrypt
        let keystore = this.app.wallet.getAccount(this.handlers[to]);
        let X = this.app.crypto.createECDHsecret(from, keystore);

        let unencryptedData = this.app.crypto.decryptECDH(new Buffer(payload, 'hex'), X);
        let request = bitowl.data.unpack(unencryptedData);
        let {
            requestId,
            requestDomain,
            requestType,
            requestBody,
            requestSignature
        } = request;
        //verify sign
        let sigData = this.app.orwell.hash(new Buffer(requestBody.split(" " + requestSignature).join("")));
        let res = this.app.crypto.verify(from, requestSignature, sigData);

        if (!res)
            throw new Error('Invalid signature for dapp request');

        let settings = this.app.cnf('dapps').list[this.handlers[to]];

        if (requestType == 'http') {
            this.makeHttpRequest(settings, requestBody)
                .then((response) => {
                    let signature = this.app.crypto.sign(keystore.privateKey, this.app.orwell.hash(new Buffer(response))).toString('hex');
                    let response_data = bitowl.data.pack({
                        requestId: requestId,
                        responseBody: response,
                        responseSignature: signature
                    });

                    let payload = this.app.crypto.encryptECDH(response_data, X);
                    //send to blockchain
                    this.app.network.protocol.sendAll('dappres', {
                        from: keystore.publicKey,
                        to: from,
                        payload: payload.toString('hex')
                    });

                })
        } else
            throw new Error('Unsupported request type ' + requestType);
    }
    makeHttpRequest(settings, request) {
        let hostAndPort = settings.endpoint;
        let a = hostAndPort.split(":");
        return new Promise((resolve, reject) => {
            //TODO: timeout error
            let rawResponse = '';
            let data = request.split("\n");

            this.app.debug('info', 'dApp/server', 'handle request to ' + hostAndPort, data[0] + " ", data[1]);
            let socket = net.connect(a[1] ? a[1] : 80, a[0], () => {

                socket.setTimeout(settings.timeout || 30000);
                socket.on('timeout', () => {
                    socket.end();
                    resolve("408 Request Timeout\r\nConnection: close\r\n\r\n");
                });

                // send http request:
                socket.write(request.replace(/Host: (.*)\n/i, 'Host: ' + hostAndPort + '\n'));
                setTimeout(() => {
                    socket.end();
                }, 1000);
                // assume utf-8 encoding:
                socket.setEncoding('utf-8');

                socket.on('error', (e) => {
                    reject({ error: e, response: rawResponse });
                });

                socket.on('data', (chunk) => {
                    rawResponse += chunk;
                });
                socket.on('end', () => {
                    //ask all:
                    //script | js
                    //link | css
                    //images | img

                    let res = rawResponse.split("\r\n\r\n");
                    let headers = res[0].split("\r\n");
                    let status = headers[0];
                    let contentType;
                    for (let i in headers) {
                        if (headers[i])
                            if (headers[i].toLowerCase().indexOf('content-type') != -1)
                                contentType = headers[i].toLowerCase().replace("content-type: ", "");
                    }

                    this.app.debug('info', 'dApp/server', data[0] + " ", data[1] + ' ' + 'send response ' + status + " ", contentType, (new Buffer(res[1]).length / 1024) + " kbytes");

                    resolve(rawResponse);
                });

            })
        })
    }

    //handling response
    handleResponse(data) {
        let { from, to, payload } = data;
        let account = this.app.cnf('dapp-client');
        if (account.publicKey != to)
            return false;

        //unencrypt
        let X = this.app.crypto.createECDHsecret(from, account);

        let unencryptedData = this.app.crypto.decryptECDH(new Buffer(payload, 'hex'), X);
        let response = bitowl.data.unpack(unencryptedData);
        let {
            requestId,
            responseBody,
            responseSignature
        } = response;
        //verify sign

        let sigData = this.app.orwell.hash(new Buffer(responseBody));
        let res = this.app.crypto.verify(from, responseSignature, sigData);

        if (!res)
            throw new Error('Invalid signature for dapp request');

        response.from = from;
        response.to = to;

        this.app.emit("dappres/" + requestId, response);
    }

}

module.exports = dApps;
