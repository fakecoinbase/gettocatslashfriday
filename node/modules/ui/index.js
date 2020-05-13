const createError = require('http-errors');
class gui {
    constructor(app) {
        this.app = app;
    }
    init() {
        //start express
        this.expressApp = require('./app');

        this.initRules();

        this.expressApp.listen(this.app.cnf('ui').port, this.app.cnf('ui').host, () => {
            this.app.debug('info', 'ui', 'http ui listening on port ' + this.app.cnf('ui').port);
        });
    }
    initRules() {

        const explorer = require('./routes/explorer');
        const wallet = require('./routes/wallet');
        const dashboard = require('./routes/dashboard');
        const dataRouter = require('./routes/data');

        this.expressApp.use('/explorer', (req, res, next) => {
            (explorer(this.app))(req, res, next);
        });

        this.expressApp.use('/wallet', (req, res, next) => {
            (wallet(this.app))(req, res, next);
        });

        this.expressApp.use('/data', (req, res, next) => {
            (dataRouter(this.app))(req, res, next);
        });

        this.expressApp.use('/', (req, res, next) => {
            (dashboard(this.app))(req, res, next);
        });
        

        // catch 404 and forward to error handler
        this.expressApp.use(function (req, res, next) {
            next(createError(404));
        });
    }

}

module.exports = gui;
