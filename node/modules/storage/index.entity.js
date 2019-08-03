class index {
    constructor(app, name, inmemory) {
        this._cache = {};
        this.app = app;
        this.class = null;
        this.coll = null;
        this.name = name;
        this.inmemory = !!inmemory;
        this.init();
    }
    init() {
        if (!this.db || !this.coll) {
            if (!this.inmemory) {
                this.db = this.app.storage.getConnection('index');
                this.coll = this.app.storage.getCollection(this.name, 'index');
            }
        }
    }
    set(key, value) {
        return new Promise((resolve) => {
            if (this.inmemory) {
                this.setCache(key, value);
                return Promise.resolve(value);
            }

            let res;
            let obj = this.coll.findOne({ 'key': key });
            if (obj && obj.value) {
                obj.value = value
                res = this.coll.update(obj);
            } else {
                obj = { key: key, value: value };
                res = this.coll.insert(obj);
            }

            this.setCache(key, value);
            this.save();
            return resolve(obj);
        });

    }
    get(key) {
        let val = this.getCache(key);
        if (this.inmemory) {
            return val || "";
        }

        if (!val) {
            val = this.coll.findOne({ 'key': key });
            if (!val || !val.value)
                val = "";
            else
                val = val.value;
        }
        return val;
    }
    find(fields) {
        if (this.inmemory)
            throw new Error('inmemory only');
        return this.coll.find(fields);
    }
    remove(key) {
        if (this.inmemory) {
            delete this._cache[this.name][key];
            return true;
        }

        let val = this.coll.findOne({ 'key': key });
        if (val)
            this.coll.remove(val);

        return !!val;
    }
    getCollection() {
        return this.coll
    }
    getDB() {
        if (!this.db)
            this.init();
        return this.db
    }
    save() {
        return this.getDB().saveDatabase();
    }
    setCache(key, val) {
        if (!this._cache[this.name])
            this._cache[this.name] = {};
        this._cache[this.name][key] = val;
    }
    getCache(key) {
        if (!this._cache[this.name])
            this._cache[this.name] = {};
        return this._cache[this.name][key] || null;
    }
    setContext(context) {
        this.context = context;
    }
    getContext() {
        return this.context;
    }
    getContextList() {
        let val = this.getDB().gc('context').findOne({ 'key': this.context });
        if (!val || !val.value)
            val = [];
        else
            val = val.value;

        return val;
    }
    setContextList(arr) {
        if (!arr || !(arr instanceof Array))
            arr = [];

        let obj = this.getDB().gc('context').findOne({ 'key': this.context });
        if (obj) {
            obj.value = arr
            this.getDB().gc('context').update(obj);
        } else {
            obj = { key: this.context, value: arr };
            this.getDB().gc('context').insert(obj);
        }
    }
    contextAdd(key) {
        let list = this.getContextList();
        if (list.indexOf(this.name + ":" + key) < 0)
            list.push(this.name + ":" + key);

        this.setContextList(list);
    }
    contextRemove(key) {
        let list = this.getContextList();
        if (list.indexOf(this.name + ":" + key) >= 0)
            list.splice(list.indexOf(this.name + ":" + key), 1);

        this.setContextList(list);
    }
    deleteDB() {
        //todo
        //this.getDB().close();
        //this.getDB().deleteDatabase();
    }

}

module.exports = index;