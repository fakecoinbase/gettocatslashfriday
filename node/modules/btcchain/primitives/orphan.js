module.exports = (app) => {
    class OrphanPool extends app.storage.Index {
        constructor() {
            super(app, 'orphan', false);
            this.init();
        }

        getList() {
            let arr = this.get('orphanlist');
            if (!arr || !(arr instanceof Array))
                arr = [];
            return arr;
        }

        setList(arr) {
            this.set('orphanlist', arr || []);
            return arr || [];
        }

        getCount() {
            return this.getList().length;
        }

        appendToList(hash){
            let list = this.getList();
            if (!list || !(list instanceof Array))
                list = [];
    
            if (list.indexOf(hash) < 0)
                list.push(hash);
    
            this.setList(list);
        }

        removeFromList(hash){
            let list = this.getList();
            if (!list || !(list instanceof Array))
                list = [];
        
            list.splice(list.indexOf(hash), 1);
            this.setList(list);
        }

        checkBlock(block) {

            let tree = this.getTree(block.hashPrevBlock);
            let last_orphan = tree[tree.length - 1];
            let last_master;
            if (!last_orphan)
                return false;

            try {
                last_master = app.btcchain.getBlock(last_orphan.hashPrevBlock);
            } catch (e) {

            }

            if (!last_master || !last_master.hash) {
                this.seekHash(last_orphan.hashPrevBlock);
                return;
            }

            let last_master_height = app.btcchain.index.get("block/" + last_master.hash).height;
            if (last_master_height + tree.length > app.btcchain.index.getTop().height) {
                //change branch
                let startheight = app.btcchain.index.getTop().height + 1;
                for (let i = tree.length - 1; i >= 0; i-- , startheight++) {
                    let curr_lock_hash = app.btcchain.index.get("index/" + startheight);
                    if (typeof curr_lock_hash == 'string') {
                        let curr_block_old = app.btcchain.getBlock(curr_lock_hash);
                        //replace in master
                        app.btcchain.replaceBlock(startheight, curr_block_old.hash, tree[i]);
                        //replace in orphan
                        this.replaceBlock(startheight, tree[i], curr_block_old.hash);
                    } else {
                        let block = app.btcchain.BLOCK.fromJSON(app, tree[i]);
                        app.btcchain.appendBlock(block, false, (block_added, isExist, iMainChain) => {
                            this.removeBlock(block_added.hash);
                        });
                    }
                }

            } else {
                //check old, gc
                if (app.btcchain.index.getTop().height - last_master_height + tree.length > 100) {//do not save orphan block more that 100 height over
                    for (let i in tree) {
                        this.removeBlock(tree[i].hash);
                    }
                }
            }

        }
        getTree(from_hash) {
            let arr = [], prev = from_hash;
            do {
                let b = prev;
                let block = this.get(b);

                if (block.hash) {
                    arr.push(block);
                    prev = block.hashPrevBlock;
                }
            } while (block.hash);

            return arr;
        }
        seekHash(hash) {
            //TODO handle this event
            app.emit("chain.block.seek", { hash: hash })
        }
        replaceBlock(index, from, to) {
            this.removeBlock(from.hash);
            this.addBlock(to);
        }
        check(hash) {
            let block = this.get(hash);
            if (!block || !block.hash)
                return false;

            return this.checkBlock(block);

        }
        isExist(hash) {
            let block = this.get(hash);
            if (!block || !block.hash)
                return false;

            return true;
        }
        addBlock(blockjson) {
            let obj = this.get(blockjson.hash);
            if (!obj || !obj.hash) {
                this.appendToList(blockjson.hash);
                this.set(blockjson.hash, blockjson);
                return true;
            }

            return false;
        }
        removeBlock(hash) {
            this.removeFromList(hash);
            this.remove(hash);
        }

        findChilds(hash) {
            let list = this.getList();
            let childs = [];

            for (let i in list) {
                let block = this.get(list[i]);
                if (block && block.hash) {
                    if (block.prev_block == hash || block.hashPrevBlock == hash) {
                        childs.push(block);
                    }
                }
            }

            return childs;
        }

        findChildsRecursive(hash, data, level) {

            if (!Number.isFinite(level))
                data = {};

            if (!Number.isFinite(level))
                level = 0;

            let childs = this.findChilds(hash);

            if (data[level] && data[level].childs && childs.length)
                data[level].childs = data[level].childs.concat(childs);
            else if (childs.length)
                data[level] = { level: level, childs: childs };

            for (let i in childs) {
                if (childs[i] && childs[i].hash)
                    data = this.findChildsRecursive(childs[i].hash, data, level + 1)
            }

            return data;

        }

        getMaxPath(childs) {

            let arr = Object.keys(childs);
            let maxKey = Math.max.apply(null, arr);
            let maxData = childs[maxKey];
            if (!maxData || !maxData.childs || maxData.childs.length != 1)//do nothing if we have more then one childs (wait for next orphan)
                return false;

            return maxKey;

        }

        tryApplyLongestBranch = function (hash) {
            //find all childs on all levels, choose longest chain and send event.
            let childsByLevel = this.findChildsRecursive(hash, {}, 0)
            let biggestPath = this.getMaxPath(childsByLevel);

            if (biggestPath) {
                let maxValue = childsByLevel[biggestPath];
                let orphanTop = maxValue.childs[0];
                if (orphanTop && orphanTop.hash) {
                    //now we have chain, where head in orphan db, and tail in main chain. Now we need check - can we use this chain as main chain
                    return this.checkBlock(orphanTop);
                }
            }

            return false;
        }

    }


    return OrphanPool;
}