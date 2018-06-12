const diff = require('recursive-diff');

class State {

    constructor(app) {
        this.app = app;
        this.states = {};
        this.diffs = {};
    }
    init() {
        this.loadLatest();
    }
    loadLatest() {
        this.app.db.load('states_diffs.json', 'diffs');
        this.app.db.load('states.json', 'states');
        this.states = this.app.db.get('states');
        this.diffs = this.app.db.get('diffs');
    }
    getLatestStateNumber() {
        let statesNumbers = Object.keys(this.states);
        return Math.max.apply(null, statesNumbers) || 0
    }
    getLatest() {
        let latestNumber = this.getLatestStateNumber();
        let prevState = this.states[latestNumber];
        if (!prevState || !latestNumber)
            return {};

        return prevState;
    }
    getPreviousState() {
        let latestNumber = this.getLatestStateNumber();
        let prevState = this.states[latestNumber];
        if (!prevState || !latestNumber)
            return {};
    }
    createRaw(index) {
        let _state = [];
        let arr = index['DATA'];
        
        for (let key in arr) {
            for (let i in arr[key]) {
                _state.push({ key: key, data: arr[key][i] });
            }
        }

        this.updateState(_state);

        return _state;
    }
    createDiff(blockNum, prevBlock) {
        let state = this.states[blockNum];
        let prevState = this.states[prevBlock] || {};
        return diff.getDiff(state, prevState);
    }
    updateState(_state) {
        let block = this.app.db.get('latest').number;
        this.states[block] = _state;
        this.diffs[block] = this.createDiff(block, block - 1);

        this.app.db.save('states', 'states.json');
        this.app.db.save('diffs', 'states_diffs.json');

        this.app.emit("app.state.latest", _state);
        this.app.emit("app.state.diff", this.diffs[block]);
        this.app.debug('info', 'state', 'new state', this.diffs[block]);

        return _state;
    }
}

module.exports = State;