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
});
