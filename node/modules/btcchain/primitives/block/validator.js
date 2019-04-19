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
                    res += parseInt(validator.rules[i].apply(this.block, [this, this.context, this.app]));
                } catch (e) {
                    err.push(e.code)
                }
            }

            console.log('validator', res, Object.keys(validator.rules).length, err);
            return [res == Object.keys(validator.rules).length, err];
        }
        static addRule(name, fnc) {
            validator.rules[name] = fnc;
        }
    }

    validator.rules = {};
    return validator;
}