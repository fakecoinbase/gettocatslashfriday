module.exports = function (app) {

    class validator {
        constructor(block, context) {
            this.block = block;
            this.context = context;
            this.app = app;
        }
        isValid() {
            let res = 0, err = [];
            for (let i in validator.rules) {
                try {
                    let r = validator.rules[i].apply(this.block, [this, this.context, this.app]);
                    if (r)
                        res += 1;
                } catch (e) {
                    err.push(e.code)
                }
            }

            return [res == Object.keys(validator.rules).length, err];
        }
        static addRule(name, fnc) {
            validator.rules[name] = fnc;
        }
    }

    validator.rules = {};
    return validator;
}