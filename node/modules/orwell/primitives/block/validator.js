module.exports = function (app) {

    class validator {
        constructor(block, context) {
            this.block = block;
            this.context = context;
            this.app = app;
            this.errors = [];
            this.log = [];
        }
        addError(msg, code) {
            this.errors.push({ message: msg, code: code });
            return false;
        }
        getErrors() {
            return this.errors;
        }
        getLog() {
            return this.log;
        }
        isValid() {
            let res = 0, err = [];
            for (let i in validator.rules) {
                try {
                    let r = validator.rules[i].apply(this.block, [this, this.context || {}, this.app]);
                    this.log.push({ 'action': i, 'status': r });
                    if (r)
                        res += 1;
                } catch (e) {
                    this.errors.push({ code: e.code, message: e.message, exception: true });
                    console.log('validator error', e);
                }
            }

            if (app.cnf('consensus').validationalert){
                for (let k in this.errors){
                   app.throwError(this.errors[k].message, this.errors[k].code);
                }
            }

            return res == Object.keys(validator.rules).length;
        }
        static addRule(name, fnc) {
            validator.rules[name] = fnc;
        }
    }

    validator.rules = {};
    return validator;
}