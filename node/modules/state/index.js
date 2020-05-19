class State {
    constructor(app){
        this.app = app;
    }
    init() {

    }
    createCheckPoint(){

        //i think lokijs have something about group and aggregate functional
        //but - no. So, before we need to change db engine. TODO.

        //find all addressess
        //let list = this.app.orwell.utxh;
        //calculate balance for each
        //create merkle tree
        //calculate StateRoot

        //findAll datascript:address
        //create merkle tree
        //calculate dsRoot

    }
}

module.exports = State;