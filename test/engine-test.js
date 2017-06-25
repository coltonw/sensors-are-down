const assert = require('assert');
const _ = require('lodash');
const engine = require('../lib/engine');

describe('engine initialization', () => {
  it('should initialize properly', () => {
    const store = engine.init(null);
    store.dispatch(engine.startGame());
    console.dir(store.getState().game.offenseCardChoices);
    const choiceNames = _.map(
      _.values(store.getState().game.offenseCardChoices.playerCards), value => value.name);
    assert.equal(choiceNames.length, 2, 'there are two choices');
    const allOffense = _.every(_.values(store.getState().game.offenseCardChoices.playerCards),
      card => card.offense);
    assert(allOffense, 'all the offensive choices are offense');
  });
});
