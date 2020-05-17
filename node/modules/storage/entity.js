class entity {
    constructor(app, name, dbname) {
        this.app = app;
        this.class = null;
        this.dbname = dbname ? dbname : 'chain';
        this.db = this.app.storage.getConnection(this.dbname);
        this.coll = null;
        this.name = name;
        this.init();
    }
    init() {
        if (!this.db || !this.coll) {
            this.coll = this.app.storage.getCollection(this.name, this.dbname);
        }
    }
    save(block) {
        return new Promise((resolve)=>{
            this.coll.insert(block);
            this.saveDb();
            resolve(block); 
        });

    }
    get(hash) {
        return this.coll.findOne({ 'hash': hash });

    }
    remove(hash) {
        let obj = this.coll.findOne({ hash: hash });
        this.coll.remove(obj);
        this.saveDb();
        return true;
    }
    load(limit, offset, sortby) {
        if (!limit)
            limit = 1000

        if (!offset)
            offset = 0;
            
        let res = this.coll.chain().find().offset(offset).limit(limit);
        if (sortby)
            res = res.simplesort(sortby[0], !!sortby[1]);

        return res.data();

    }
    count() {
        return this.coll.chain().find().count();
    }
    getCollection() {
        return this.coll;
    }
    getDB() {
        return this.db
    }
    saveDb() {
        this.db.saveDatabase();
    }
    clear() {
        this.coll.chain().remove();
        return true;
    }
}

module.exports = entity;