const assert = require('assert');
const _ = require('lodash');
const engine = require('../lib/engine');

describe('engine', () => {
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

  it('should run combat in one zone properly', () => {
    const noCardsPreCombat = {
      playerCards: [],
      aiCards: [],
      keepYour: 'mangy hands off me',
    };
    const noCardsResult = engine.combatHelper(noCardsPreCombat);
    assert.deepEqual(noCardsResult, noCardsPreCombat, 'no cards to still no cards');

    const oneSideCardsPreCombat = {
      playerCards: [{ strength: 2, defense: 1 }, { strength: 1 }],
      aiCards: [],
      pleaseDont: 'touch this',
    };
    const oneSideCardsResult = engine.combatHelper(oneSideCardsPreCombat);
    assert.deepEqual(oneSideCardsResult, oneSideCardsPreCombat, 'one card to still one card');

    const evenStrengthPreCombat = {
      playerCards: [{ strength: 2 }, { strength: 1 }],
      aiCards: [{ strength: 3 }],
    };
    const evenStrengthResult = engine.combatHelper(evenStrengthPreCombat);
    assert.deepEqual(evenStrengthResult, { playerCards: [], aiCards: [] }, 'even strength everything dies');

    const defenseBonusWorksResult = engine.combatHelper({
      playerCards: [{ strength: 4, someIgnored: 'stuff' }],
      aiCards: [{ strength: 3 }],
    });
    assert.deepEqual(defenseBonusWorksResult, {
      playerCards: [{ strength: 2, someIgnored: 'stuff' }],
      aiCards: [],
    }, 'defense bonus works as expected');

    const offenseWorksResult = engine.combatHelper({
      playerCards: [{ strength: 4, someIgnored: 'stuff' }],
      aiCards: [{ strength: 3, offense: 2 }],
    });
    assert.deepEqual(offenseWorksResult, {
      playerCards: [],
      aiCards: [],
    }, 'offense on cards works properly');

    const defenseWorksResult = engine.combatHelper({
      playerCards: [{ strength: 4, someIgnored: 'stuff' }],
      aiCards: [{ strength: 3, defense: 2 }],
    });
    assert.deepEqual(defenseWorksResult, {
      playerCards: [{ strength: 2, someIgnored: 'stuff' }],
      aiCards: [{ strength: 1, defense: 2 }],
    }, 'defense on cards works properly');
  });
});
