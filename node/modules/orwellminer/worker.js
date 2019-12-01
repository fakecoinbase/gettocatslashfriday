module.exports = function () {
    self.onmessage = function (ev) {

        let blockInfo = ev.data;
        let DAPP = require("../../../index");
        let config = require('../../../config.orwell.json');
        let app = new DAPP(config);
        app.noConflict((stage) => {//stage can be beforeload (additional modules is not loaded yet) and beforeinit (additional modules is loaded but not inited)
            if (stage == 'beforeload') {
                app.config.arg[app.config.arg.network].rpc.useServer = false;
            }
        })
        app.skipModules(['network', 'rpc']);

        app.on('init', () => {
            let block = app.orwell.BLOCK.fromJSON(blockInfo);

            let start = Date.now();
            block.generate((b) => {
                postMessage(JSON.stringify({
                    block: b.toJSON(),
                    stats: {
                        start: start,
                        stop: Date.now(),
                        difficulty: b.bits
                    }
                }));
            })

        });


        app.init();
    }

}