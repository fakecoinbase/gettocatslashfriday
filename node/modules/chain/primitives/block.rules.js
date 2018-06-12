let Rules = {

    list: {},
    add: function (code, callback) {
        if (Rules.list[code])
            throw new Error('Rule ' + code + ' already exist');
        Rules.list[code] = callback;
    },
    remove: function (code) {
        delete Rules.list[code]
    },
    check: function (tx, context) {
        let errors = [];
        for (let i in Rules.list) {
            let res = Rules.list[i](tx, context);
            if (res.error) {
                errors.push(res);
            }
        }

        return errors;
    }

}

module.exports = Rules;