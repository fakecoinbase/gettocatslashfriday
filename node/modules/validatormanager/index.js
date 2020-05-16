const { EventEmitter } = require('events');

class validatorManager extends EventEmitter {
    constructor(app) {
        super();
        this.app = app;
    }
    init() {
        //if synced and in network - add validator to consensus from db or config
        //get current state
        //change validator list if come tx for data with new priority from current validator

        //check every block message for merkle with current validator list - block validator

        //if currenct validator == currentNode - must fire event for miner

        //enables only when node in network and fully synced
        //if (!this.app.cnf('consensus').genesisMode && Number.isFinite(this.app.orwell.index.get('top').height))
        //    this.checkActiveValidator();

        this.initValidators();
    }
    checkActiveValidator() {
        let old = this.current;
        this.initValidators();

        this.app.debug("info", "validatormanager", "update validator list - old: " + old + " new: " + this.current);
        if (this.current == this.app.cnf('node').publicKey) {
            this.checkValidatorsPriority()
                .then((hash) => {
                    if (hash) {
                        this.app.debug("info", "validatormanager", "update validators priority tx:", hash);
                    }
                    let newblock = this.createBlock(this.app.orwell.TX.writeCoinbaseBytes('default client', this.app.getAgentName().name + ":" + this.app.getAgentName().version));
                    this.app.debug("info", "validatormanager", "current node is active validator, created block ", newblock.getHash());
                    this.app.orwell.addBlockFromNetwork(null, newblock)
                        .then((data) => {
                            this.app.debug("info", "validatormanager", "added block to consensus");
                            data.send();
                        });
                })

        }
    }
    initValidators() {
        let def = this.app.cnf('consensus').delegates;
        let list = this.app.orwell.dsIndex.getMasternodes() || [];
        let keys = [];
        let priority = {};
        for (let i in def) {
            priority[def[i]] = 0;
        }

        for (let i in list) {
            keys.push(list[i].key);
            priority[list[i].key] = list[i].priority;
        }

        keys = keys.concat(def);
        for (let i in keys) {
            if (!this.app.orwell.consensus.roundManager.isValidator(keys[i]))
                this.app.orwell.consensus.roundManager.addValidator(keys[i], priority[keys[i]], this.getValidatorVolume(keys[i]));
        }

        let vals = this.app.orwell.consensus.roundManager.getAllValidatorsList();
        for (let i in vals) {
            if (keys.indexOf(vals[i]) == -1)
                this.app.orwell.consensus.roundManager.removeValidator(vals[i]);
        }

        this.app.orwell.consensus.roundManager.initCursor();
        let d = this.app.orwell.consensus.roundManager.getNextState();
        this.validators = d.validators;
        this.current = this.validators[d.cursor];
    }
    getValidatorVolume(key, height) {
        let amount = this.app.wallet.getAddressBalance(this.app.orwell.ADDRESS.generateAddressFromPublicKey(key), height);
        return amount + this.getValidatorDelegatedAmount(key, height);
    }
    getValidatorDelegatedAmount(key, height) {
        //TODO: +delegatedAmount
        return 0;
    }
    createBlock(coinbaseBytes, keystore) {
        if (!keystore)
            keystore = { public: this.app.cnf('node').publicKey, private: this.app.cnf('node').privateKey };

        this.initValidators();

        if (this.current == keystore.public)
            return this.app.orwell.BLOCK.createNewBlock(coinbaseBytes, keystore, this.validators);
        else
            throw new Error('This not is not active validator, wait ' + this.current);
    }
    checkValidatorsPriority(activeValidatorAccount) {
        //list of all validators
        //if have unsynced data - create tx to system/masternode
        let updates = [];
        for (let i in this.validators) {
            let val = this.app.orwell.consensus.roundManager.getValidator(this.validators[i]);
            if (!val.isPriorityConfirmed()) {
                updates.push({ key: val, priority: val });
            }
        }

        if (updates.length > 0)
            return app.orwell.updateMasternode(activeValidatorAccount, updates)
        return Promise.resolve();
    }

}

module.exports = validatorManager;