const assert = require('assert');
const { playSpecials } = require('../lib/specials');

describe('specials', () => {
  it('should run scrapHarvesters properly', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [],
          aiCards: [],
        },
        aiShip: {
          playerCards: [],
          aiCards: [],
        },
      },
      planet: {
        playerCards: [{ cardId: 'youAboutToDie', strength: 0 }],
        aiCards: [{ cardId: 'scrapHarvesters', strength: 2, special: 'postcombat' }],
      },
    };
    const postCombatState = {
      ...preCombatState,
      planet: {
        playerCards: [],
        aiCards: [{ cardId: 'scrapHarvesters', strength: 2, special: 'postcombat' }],
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.planet.aiCards[0].strength, 3);
  });
  it('should revive reanimatingSlivers properly', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [],
          aiCards: [],
        },
        aiShip: {
          playerCards: [{ cardId: 'strongCard', strength: 4 }],
          aiCards: [{ cardId: 'reanimatingSlivers', strength: 3, special: 'postcombat' }],
        },
      },
      planet: {
        playerCards: [],
        aiCards: [],
      },
    };
    const postCombatState = {
      ...preCombatState,
      ships: {
        ...preCombatState.ships,
        aiShip: {
          playerCards: [{ cardId: 'strongCard', strength: 2 }],
          aiCards: [],
        },
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.ships.aiShip.aiCards.length, 1);
    assert.equal(newState.ships.aiShip.aiCards[0].strength, 2);
    assert.equal(newState.ships.aiShip.aiCards[0].zombie, true);
  });
  it('should revive multiple reanimatingSlivers properly', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [
            { cardId: 'reanimatingSlivers', cardUid: '123', strength: 3, special: 'postcombat' },
            { cardId: 'reanimatingSlivers', cardUid: '456', strength: 3, special: 'postcombat' }],
          aiCards: [{ cardId: 'strongCard', strength: 8 }],
        },
        aiShip: {
          playerCards: [],
          aiCards: [],
        },
      },
      planet: {
        playerCards: [],
        aiCards: [],
      },
    };
    const postCombatState = {
      ...preCombatState,
      ships: {
        ...preCombatState.ships,
        playerShip: {
          playerCards: [],
          aiCards: [{ cardId: 'strongCard', strength: 2 }],
        },
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.ships.playerShip.playerCards.length, 2);
    assert.equal(newState.ships.playerShip.playerCards[0].strength, 2);
    assert.equal(newState.ships.playerShip.playerCards[0].zombie, true);
    assert.equal(newState.ships.playerShip.playerCards[1].strength, 2);
    assert.equal(newState.ships.playerShip.playerCards[1].zombie, true);
  });
  it('should not revive living reanimatingSlivers properly', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [
            { cardId: 'reanimatingSlivers', cardUid: '123', strength: 3, special: 'postcombat' }],
          aiCards: [{ cardId: 'weakCard', strength: 2 }],
        },
        aiShip: {
          playerCards: [],
          aiCards: [],
        },
      },
      planet: {
        playerCards: [],
        aiCards: [],
      },
    };
    const postCombatState = {
      ...preCombatState,
      ships: {
        ...preCombatState.ships,
        playerShip: {
          playerCards: [
            { cardId: 'reanimatingSlivers', cardUid: '123', strength: 2, special: 'postcombat' }],
          aiCards: [],
        },
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.ships.playerShip.playerCards.length, 1);
    assert.deepEqual(newState.ships.playerShip.playerCards,
      postCombatState.ships.playerShip.playerCards);
  });
});
