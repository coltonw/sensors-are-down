const assert = require('assert');
const { playSpecials } = require('../lib/specials');

describe('specials', () => {
  it('should run scrapHarvesters properly', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [],
        },
        aiShip: {
          playerCards: [],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [],
        },
      },
      planet: {
        playerCards: [{ cardId: 'youAboutToDie', strength: 0 }],
        aiCards: [{ cardId: 'scrapHarvesters', strength: 2, special: 'postcombat' }],
        playerGraveyard: [],
        aiGraveyard: [],
      },
    };
    const postCombatState = {
      ...preCombatState,
      planet: {
        playerCards: [],
        aiCards: [{ cardId: 'scrapHarvesters', strength: 2, special: 'postcombat' }],
        playerGraveyard: [{ cardId: 'youAboutToDie', strength: 0 }],
        aiGraveyard: [],
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
          playerGraveyard: [],
          aiGraveyard: [],
        },
        aiShip: {
          playerCards: [{ cardId: 'strongCard', strength: 4 }],
          aiCards: [{ cardId: 'reanimatingSlivers', cardUid: '123', strength: 3, special: 'postcombat' }],
          playerGraveyard: [],
          aiGraveyard: [],
        },
      },
      planet: {
        playerCards: [],
        aiCards: [],
        playerGraveyard: [],
        aiGraveyard: [],
      },
    };
    const postCombatState = {
      ...preCombatState,
      ships: {
        ...preCombatState.ships,
        aiShip: {
          playerCards: [{ cardId: 'strongCard', strength: 2 }],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [{ cardId: 'reanimatingSlivers', cardUid: '123', strength: 0, special: 'postcombat' }],
        },
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.ships.aiShip.aiCards.length, 1);
    assert.equal(newState.ships.aiShip.aiCards[0].strength, 2);
    assert.equal(newState.ships.aiShip.aiCards[0].raw.zombie, true);
    assert.equal(newState.ships.aiShip.aiGraveyard.length, 0);
  });
  it('should revive reanimatingSlivers only once', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [],
        },
        aiShip: {
          playerCards: [{ cardId: 'strongCard', strength: 4 }],
          aiCards: [{ cardId: 'reanimatingSlivers', strength: 3, raw: { zombie: true }, special: 'postcombat' }],
          playerGraveyard: [],
          aiGraveyard: [],
        },
      },
      planet: {
        playerCards: [],
        aiCards: [],
        playerGraveyard: [],
        aiGraveyard: [],
      },
    };
    const postCombatState = {
      ...preCombatState,
      ships: {
        ...preCombatState.ships,
        aiShip: {
          playerCards: [{ cardId: 'strongCard', strength: 2 }],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [{ cardId: 'reanimatingSlivers', strength: 0, raw: { zombie: true }, special: 'postcombat' }],
        },
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.ships.aiShip.aiCards.length, 0);
  });
  it('should revive multiple reanimatingSlivers properly', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [
            { cardId: 'reanimatingSlivers', cardUid: '123', strength: 3, special: 'postcombat' },
            { cardId: 'reanimatingSlivers', cardUid: '456', strength: 3, special: 'postcombat' }],
          aiCards: [{ cardId: 'strongCard', strength: 8 }],
          playerGraveyard: [],
          aiGraveyard: [],
        },
        aiShip: {
          playerCards: [],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [],
        },
      },
      planet: {
        playerCards: [],
        aiCards: [],
        playerGraveyard: [],
        aiGraveyard: [],
      },
    };
    const postCombatState = {
      ...preCombatState,
      ships: {
        ...preCombatState.ships,
        playerShip: {
          playerCards: [],
          aiCards: [{ cardId: 'strongCard', strength: 2 }],
          playerGraveyard: [
            { cardId: 'reanimatingSlivers', cardUid: '123', strength: 0, special: 'postcombat' },
            { cardId: 'reanimatingSlivers', cardUid: '456', strength: 0, special: 'postcombat' }],
          aiGraveyard: [],
        },
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.ships.playerShip.playerCards.length, 2);
    assert.equal(newState.ships.playerShip.playerCards[0].strength, 2);
    assert.equal(newState.ships.playerShip.playerCards[0].raw.zombie, true);
    assert.equal(newState.ships.playerShip.playerCards[1].strength, 2);
    assert.equal(newState.ships.playerShip.playerCards[1].raw.zombie, true);
    assert.equal(newState.ships.playerShip.playerGraveyard.length, 0);
  });
  it('should not revive living reanimatingSlivers properly', () => {
    const preCombatState = {
      ships: {
        playerShip: {
          playerCards: [
            { cardId: 'reanimatingSlivers', cardUid: '123', strength: 3, special: 'postcombat' }],
          aiCards: [{ cardId: 'weakCard', strength: 2 }],
          playerGraveyard: [],
          aiGraveyard: [],
        },
        aiShip: {
          playerCards: [],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [],
        },
      },
      planet: {
        playerCards: [],
        aiCards: [],
        playerGraveyard: [],
        aiGraveyard: [],
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
          playerGraveyard: [],
          aiGraveyard: [{ cardId: 'weakCard', strength: 0 }],
        },
      },
    };
    const newState = playSpecials('postcombat', postCombatState, preCombatState);
    assert.equal(newState.ships.playerShip.playerCards.length, 1);
    assert.deepEqual(newState.ships.playerShip.playerCards,
      postCombatState.ships.playerShip.playerCards);
  });
  it('should run planetaryBombers properly', () => {
    const state = {
      currentTurn: 3,
      defenseCardChoices: {
        playerCards: {
          defender: {},
        },
        aiCards: {
          planetaryBombers: { special: 'precombat' },
        },
      },
      ships: {
        playerShip: {
          playerCards: [],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [],
        },
        aiShip: {
          playerCards: [],
          aiCards: [],
          playerGraveyard: [],
          aiGraveyard: [],
        },
      },
      planet: {
        playerCards: [{ cardId: 'youAboutToDie', strength: 100, turnPlayed: 2, phasePlayed: 'defense' },
          { cardId: 'dead', strength: 5 }, { cardId: 'defender', strength: 3, turnPlayed: 3, phasePlayed: 'defense' }],
        aiCards: [{ cardId: 'alsoAboutToDie', turnPlayed: 3, phasePlayed: 'offense' },
          { cardId: 'planetaryBombers', strength: 1, special: 'precombat', turnPlayed: 3, phasePlayed: 'defense' }],
        playerGraveyard: [],
        aiGraveyard: [],
      },
    };
    const newState = playSpecials('precombat', state);
    assert.equal(newState.planet.playerCards.length, 1);
    assert.equal(newState.planet.playerCards[0], state.planet.playerCards[2]);
    assert.equal(newState.planet.aiCards.length, 1);
    assert.equal(newState.planet.aiCards[0], state.planet.aiCards[1]);
    assert.equal(newState.planet.playerGraveyard.length, 2);
    assert.equal(newState.planet.aiGraveyard.length, 1);
  });
});
