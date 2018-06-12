const DAPP = require("../node/index")
let app = new DAPP();

app.on("app.debug", function (data) {
    if (data.module == 'network' || data.module == 'handler')
        return false;
    console.log("[" + new Date().toLocaleTimeString() + "]", "< " + data.level + " >", data.module, data.text);
});

module.exports = app;
//console.log(app.cnf())
