module.exports = (app) => {
    class BlockPool extends app.storage.Entity {
        constructor() {
            super(app, 'blocks')
            this.init();
        }
        getLastBlocks(limit, offset) {
            if (!limit)
                limit = 1;
            if (!offset)
                offset = 0

            return this.coll.chain().find().simplesort('time', true).offset(offset).limit(limit).data();
        }
        findBlocks(fields) {
            return this.coll.chain().find(fields).data();
        }
        getLastBlock() {
            let arr = this.coll.chain().find().simplesort('time', true).limit(1).offset(0).data();
            return arr[0];
        }
        getFirstBlock() {
            let arr = this.coll.chain().find().simplesort('time', false).limit(1).offset(0).data();
            return arr[0];
        }
        loadBlocks(cnt, offset) {
            return this.load(cnt, offset, ['time', false]) || false;
        }
        blockCount() {
            return this.count() || 0;
        }
        getBlock(hash) {
            let block = this.get(hash);
            if (!block)
                throw new Error('can not find block ' + hash);
            return block
        }
        removeBlock(block) {
            this.remove(block.hash);
        }

    }

    return BlockPool;
}