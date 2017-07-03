const { createStore, combineReducers } = require('redux');
const _ = require('lodash');
const config = require('config');
const playSpecials = require('./specials').playSpecials;

let store;

// actions

const START_GAME = 'START_GAME';
const PICK_OFFENSE_CARD = 'PICK_OFFENSE_CARD';
const PICK_DEFENSE_CARD = 'PICK_DEFENSE_CARD';
const CONTINUE_WITHOUT_SELECTION = 'CONTINUE_WITHOUT_SELECTION';

function startGame() {
  const allCards = config.get('cards');
  return {
    type: START_GAME,
    allCards,
  };
}

function pickOffenseCard(cardId) {
  return {
    type: PICK_OFFENSE_CARD,
    cardId,
    player: 'player',
  };
}

function pickDefenseCard(cardId) {
  return {
    type: PICK_DEFENSE_CARD,
    cardId,
    player: 'player',
  };
}

function continueWithoutSelection() {
  return {
    type: CONTINUE_WITHOUT_SELECTION,
    player: 'player',
  };
}

// reducers

// game engine reducer helpers

// UGH. No object spread operators!!!

// filter a map of cards and then pick randomly from the filtered set
const pickRandomCards = (cardsObj, count = 1, filter) => {
  const allCardIds = Object.keys(cardsObj);
  const filteredCardIds = filter ?
    _.filter(allCardIds, cardId => filter(cardsObj[cardId])) : allCardIds;
  const cardIds = _.sampleSize(filteredCardIds, count);
  return cardIds.reduce((acc, cardId) => _.assign({}, acc, {
    [cardId]: cardsObj[cardId],
  }), {});
};

function createDecks({ state, action }) {
  const playerDeck = pickRandomCards(action.allCards, 4);
  const aiDeck = pickRandomCards(action.allCards, 4);
  return {
    state: _.assign({}, state, {
      playerDeck,
      aiDeck,
    }),
    action,
  };
}

function validateCardChoice(choices, cardId) {
  return choices && choices[cardId] ? choices[cardId] : null;
}

function removeFromDeck({ state, action }) {
  const deckKey = action.player === 'ai' ? 'aiDeck' : 'playerDeck';
  const card = state[deckKey][action.cardId];

  // count defaults to 1
  const cardCount = typeof card.count === 'number' ? card.count : 1;
  // if this is the last copy of the card, delete it from the deck
  const updatedState = cardCount <= 1 ? _.assign({}, state, {
    [deckKey]: _.omit(state[deckKey], action.cardId),
  }) : _.assign({}, state, {
    [deckKey]: _.assign({}, state[deckKey], {
      [action.cardId]: _.assign({}, card, {
        count: card.count - 1,
      }),
    }),
  });
  return {
    state: updatedState,
    action,
  };
}

function selectCard({ state, action }) {
  if (state.defenseCardChoices) {
    return {
      state: _.assign({}, state, {
        defenseCardChoices: _.assign({}, state.defenseCardChoices, {
          playerCards: _.pick(state.defenseCardChoices.playerCards, action.cardId),
        }),
      }),
      action };
  } else if (state.offenseCardChoices) {
    return {
      state: _.assign({}, state, {
        offenseCardChoices: _.assign({}, state.offenseCardChoices, {
          playerCards: _.pick(state.offenseCardChoices.playerCards, action.cardId),
        }),
      }),
      action };
  }
  return {
    state,
    action };
}

function addCardDefaults(cardId, card) {
  return _.assign({}, card, {
    cardId,
    strength: card.strength || 0,
  });
}

function playCardsHelper(ships, planet, playerCards, ship, cardChoices) {
  _.forEach(Object.keys(cardChoices[playerCards]), (cardId) => {
    const card = cardChoices[playerCards][cardId];
    if (card.planet) {
      // eslint-disable-next-line no-param-reassign
      planet = _.assign({}, planet, {
        [playerCards]: [...planet[playerCards], addCardDefaults(cardId, card)],
      });
    } else if (card.space) {
      // eslint-disable-next-line no-param-reassign
      ships = _.assign({}, ships, {
        [ship]: _.assign({}, ships[ship], {
          [playerCards]: [...ships.playerShip[playerCards], addCardDefaults(cardId, card)],
        }),
      });
    }
  });
  return {
    planet,
    ships,
  };
}

function playCards({ state: prePlayState, action }) {
  // in case it matters, cards are played "simultaneously"
  // if ordering matters, effects will have a specific order they run in
  // the cards are usually "played" by being added to the current state of
  // the ships and planet
  const state = playSpecials('preplaycards', prePlayState);
  let ships = state.ships;
  let planet = state.planet;
  if (state.defenseCardChoices) {
    const playerHelperResult = playCardsHelper(ships, planet, 'playerCards', 'playerShip', state.defenseCardChoices);
    ships = playerHelperResult.ships;
    planet = playerHelperResult.planet;
    const aiHelperResult = playCardsHelper(ships, planet, 'aiCards', 'aiShip', state.defenseCardChoices);
    ships = aiHelperResult.ships;
    planet = aiHelperResult.planet;
  } else if (state.offenseCardChoices) {
    const playerHelperResult = playCardsHelper(ships, planet, 'playerCards', 'aiShip', state.offenseCardChoices);
    ships = playerHelperResult.ships;
    planet = playerHelperResult.planet;
    const aiHelperResult = playCardsHelper(ships, planet, 'aiCards', 'playerShip', state.offenseCardChoices);
    ships = aiHelperResult.ships;
    planet = aiHelperResult.planet;
  }

  return { state: _.assign({}, state, {
    ships,
    planet,
  }),
    action };
}

function pickOpponentOffenseCard({ state, action }) {
  // picks the card randomly and puts it in offenseCardChoices.aiCards
  const stateWithPickedCards = _.assign({}, state, {
    offenseCardChoices: _.assign({}, state.offenseCardChoices, {
      aiCards: pickRandomCards(state.aiDeck, 1, card => card.offense),
    }),
  });
  if (Object.keys(stateWithPickedCards.offenseCardChoices.aiCards).length > 0) {
    return {
      state: removeFromDeck({
        state: stateWithPickedCards,
        action: {
          player: 'ai',
          cardId: Object.keys(stateWithPickedCards.offenseCardChoices.aiCards)[0],
        },
      }).state,
      action,
    };
  }
  return { state: stateWithPickedCards, action };
}


const defenseFilter = opponentOffenseCards => (card) => {
  const offCardKeys = Object.keys(opponentOffenseCards);
  if (offCardKeys.length > 0 && opponentOffenseCards[offCardKeys[0]].space) {
    return card.defense && card.space;
  } else if (offCardKeys.length > 0 && opponentOffenseCards[offCardKeys[0]].planet) {
    return card.defense && card.planet;
  }
  // TODO: possibly change this to false. No reason to send defend against nothing
  return card.defense;
};

function pickOpponentDefenseCard({ state, action }) {
  // picks the card randomly and puts it in defenseCardChoices.aiCards
  // this relies on offenseCardChoices.playerCards so that needs to be maintained
  // to this point
  // TODO also pay attention to existing opponents cards on the ship or planet
  const stateWithPickedCards = _.assign({}, state, {
    defenseCardChoices: _.assign({}, state.defenseCardChoices, {
      aiCards: pickRandomCards(state.aiDeck, 1,
          defenseFilter(state.offenseCardChoices.playerCards)),
    }),
  });
  if (Object.keys(stateWithPickedCards.defenseCardChoices.aiCards).length > 0) {
    return {
      state: removeFromDeck({
        state: stateWithPickedCards,
        action: {
          player: 'ai',
          cardId: Object.keys(stateWithPickedCards.defenseCardChoices.aiCards)[0],
        },
      }).state,
      action,
    };
  }
  return { state: stateWithPickedCards, action };
}

function presentOffenseChoices({ state, action }) {
  return {
    state: _.assign({}, state, {
      offenseCardChoices: _.assign({}, state.offenseCardChoices, {
        playerCards: pickRandomCards(state.playerDeck, 2, card => card.offense),
      }),
      defenseCardChoices: null,
    }),
    action };
}

function presentDefenseChoices({ state, action }) {
  // defensive options are always based on the card that was played by your opponent
  // or TODO by existing opponents cards on the ship or planet
  return {
    state: _.assign({}, state, {
      defenseCardChoices: _.assign({}, state.defenseCardChoices, {
        playerCards:
          pickRandomCards(state.playerDeck, 2, defenseFilter(state.offenseCardChoices.aiCards)),
      }),
    }),
    action };
}

function saveDefenseCardChoices({ state, action }) {
  return {
    state: _.assign({}, state, {
      prevOffenseCardChoices: _.assign({}, state.offenseCardChoices),
      prevDefenseCardChoices: _.assign({}, state.defenseCardChoices),
    }),
    action,
  };
}


function getStrength(cards) {
  return cards.reduce((curr, card) => ({
    strength: curr.strength + card.strength,
    damageStrength: curr.damageStrength + (card.damageStrength || 0),
    shieldStrength: curr.shieldStrength + (card.shieldStrength || 0),
  }), {
    strength: 0,
    damageStrength: 0,
    shieldStrength: 0,
  });
}

function checkForStalemate(state) {
  const activePlayerCards = _.some(Object.keys(state.playerDeck),
      cardId => state.playerDeck[cardId].offense);
  const activeAiCards = _.some(Object.keys(state.aiDeck),
      cardId => state.aiDeck[cardId].offense);
  // TODO: check for if combat is really stalling
  // (cards with high defense that can't kill each other)
  const checkIfStalled = (zone, cardsToCheck) =>
      _.every(cardsToCheck, cards => zone[cards].length === 0);
  if (!activePlayerCards && !activeAiCards && checkIfStalled(state.planet, ['playerCards', 'aiCards']) &&
      checkIfStalled(state.ships.playerShip, ['aiCards']) && checkIfStalled(state.ships.aiShip, ['playerCards'])) {
    return true;
  }
  return false;
}

function checkForVictory({ state, action }) {
  const playerShipDamage = state.ships.playerShip.shipDamage +
    (state.ships.playerShip.playerCards.length === 0 && state.ships.playerShip.aiCards.length > 0 ?
      1 : 0);
  const aiShipDamage = state.ships.aiShip.shipDamage +
    (state.ships.aiShip.aiCards.length === 0 && state.ships.aiShip.playerCards.length > 0 ?
      1 : 0);
  const playerEntrenched = state.planet.aiCards.length === 0 && state.planet.playerCards.length > 0;
  const aiEntrenched = state.planet.playerCards.length === 0 && state.planet.aiCards.length > 0;
  if (playerShipDamage >= 2 && aiShipDamage < 2) {
    return {
      state: _.assign({}, state, {
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerShipDefeat: true,
        },
      }),
      action,
    };
  } else if (aiShipDamage >= 2 && playerShipDamage < 2) {
    return {
      state: _.assign({}, state, {
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerShipVictory: true,
        },
      }),
      action,
    };
  } else if (playerShipDamage < 2 && aiShipDamage < 2 &&
      playerEntrenched && state.planet.playerEntrenched) {
    return {
      state: _.assign({}, state, {
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerPlanetVictory: true,
        },
      }),
      action,
    };
  } else if (playerShipDamage < 2 && aiShipDamage < 2 &&
      aiEntrenched && state.planet.aiEntrenched) {
    return {
      state: _.assign({}, state, {
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerPlanetDefeat: true,
        },
      }),
      action,
    };
  } else if (playerShipDamage >= 2 && aiShipDamage >= 2) {
    const { strength: plStrength } = getStrength(state.planet.playerCards);
    const { strength: aiStrength } = getStrength(state.planet.aiCards);
    if (plStrength > aiStrength) {
      return {
        state: _.assign({}, state, {
          offenseCardChoices: null,
          defenseCardChoices: null,
          gameEndResults: {
            playerTiebreakerVictory: true,
          },
        }),
        action,
      };
    } else if (aiStrength > plStrength) {
      return {
        state: _.assign({}, state, {
          offenseCardChoices: null,
          defenseCardChoices: null,
          gameEndResults: {
            playerTiebreakerDefeat: true,
          },
        }),
        action,
      };
    }
    return {
      state: _.assign({}, state, {
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          drawShipsDestroyed: true,
        },
      }),
      action,
    };
  } if (checkForStalemate(state)) {
    return {
      state: _.assign({}, state, {
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          drawStalemate: true,
        },
      }),
      action,
    };
  }
  return {
    state: _.assign({}, state, {
      ships: _.assign({}, state.ships, {
        playerShip: _.assign({}, state.ships.playerShip, {
          shipDamage: playerShipDamage,
        }),
        aiShip: _.assign({}, state.ships.aiShip, {
          shipDamage: aiShipDamage,
        }),
      }),
      planet: _.assign({}, state.planet, {
        playerEntrenched,
        aiEntrenched,
      }),
    }),
    action };
}

function damageCards(cards, damage) {
  return cards.reduce(({ damagedCards, damageLeft }, card) => {
    if (damageLeft >= card.strength || card.strength <= 0) {
      return { damagedCards, damageLeft: damageLeft - card.strength };
    }
    return {
      damagedCards: [
        ...damagedCards,
        _.assign({}, card, {
          strength: card.strength - damageLeft,
        }),
      ],
      damageLeft: 0,
    };
  }, { damagedCards: [], damageLeft: damage }).damagedCards;
}

function combatHelper(zone) {
  // long variable names so pl for player
  const { strength: plStrength,
    damageStrength: plDamageStr,
    shieldStrength: plShieldStr } = getStrength(zone.playerCards);
  const { strength: aiStrength,
    damageStrength: aiDamageStr,
    shieldStrength: aiShieldStr } = getStrength(zone.aiCards);
  const plDefenseBonus = plStrength > aiStrength ? 1 : 0;
  const aiDefenseBonus = plStrength < aiStrength ? 1 : 0;
  const plNewStrength = (plStrength + plShieldStr + plDefenseBonus)
    - (aiStrength + aiDamageStr);
  const aiNewStrength = (aiStrength + aiShieldStr + aiDefenseBonus)
    - (plStrength + plDamageStr);
  const plDamage = plStrength - plNewStrength > 0 ? plStrength - plNewStrength : 0;
  const aiDamage = aiStrength - aiNewStrength > 0 ? aiStrength - aiNewStrength : 0;
  const newPlCards = damageCards(zone.playerCards, plDamage);
  const newAiCards = damageCards(zone.aiCards, aiDamage);
  return _.assign({}, zone, {
    playerCards: newPlCards,
    aiCards: newAiCards,
  });
}

function clearExtraEntrenchment(planet) {
  return _.assign({}, planet, {
    playerEntrenched: planet.playerCards.length === 0 ? false : planet.playerEntrenched,
    aiEntrenched: planet.aiCards.length === 0 ? false : planet.aiEntrenched,
  });
}

function runCombat({ state, action }) {
  return {
    state: _.assign({}, state, {
      ships: _.assign({}, state.ships, {
        playerShip: combatHelper(state.ships.playerShip),
        aiShip: combatHelper(state.ships.aiShip),
      }),
      planet: clearExtraEntrenchment(combatHelper(state.planet)),
    }),
    action,
  };
}

const gameInitialState = {
  // this is an implicit state machine.
  // if any of the following choices are NOT null,
  // that is the current state
  // Note: offense and defense will both not be null
  // because defense needs to know about offense card choices
  offenseCardChoices: null,
  defenseCardChoices: null,
  error: null,
  gameEndResults: null,
  // end state machine

  ships: {
    playerShip: {
      playerCards: [],
      aiCards: [],
      shipDamage: 0,
    },
    aiShip: {
      playerCards: [],
      aiCards: [],
      shipDamage: 0,
    },
  },
  planet: {
    playerCards: [],
    aiCards: [],
    playerEntrenched: false,
    aiEntrenched: false,
  },

  prevOffenseCardChoices: null,
  prevDefenseCardChoices: null,

  // deck state
  playerDeck: {},
  aiDeck: {},
};

const game = (state = gameInitialState, action) => {
  switch (action.type) {
    case START_GAME: {
      return _.flow(
        createDecks,
        presentOffenseChoices)({
          state: gameInitialState,
          action,
        }).state;
    }
    case PICK_OFFENSE_CARD: {
      const card = validateCardChoice(state.offenseCardChoices.playerCards, action.cardId);
      if (!card) {
        return _.assign({}, state, {
          offenseCardChoices: null,
          error: 'Illegal card choice',
        });
      }
      return _.flow(
        removeFromDeck,
        pickOpponentOffenseCard,
        selectCard,
        playCards,
        presentDefenseChoices)({
          state,
          action,
        }).state;
    }
    case PICK_DEFENSE_CARD: {
      const card = validateCardChoice(state.defenseCardChoices.playerCards, action.cardId);
      if (!card) {
        return _.assign({}, state, {
          offenseCardChoices: null,
          defenseCardChoices: null,
          error: 'Illegal card choice',
        });
      }
      const checkedForVictory = _.flow(
        removeFromDeck,
        pickOpponentDefenseCard,
        selectCard,
        saveDefenseCardChoices,
        playCards,
        checkForVictory)({
          state,
          action,
        });
      if (checkedForVictory.gameEndResults) {
        return checkedForVictory.state;
      }
      return _.flow(
        runCombat,
        presentOffenseChoices)(checkedForVictory).state;
    }
    case CONTINUE_WITHOUT_SELECTION: {
      if (state.defenseCardChoices) {
        const checkedForVictory = _.flow(
          pickOpponentDefenseCard,
          selectCard,
          saveDefenseCardChoices,
          playCards,
          checkForVictory)({
            state,
            action,
          });
        if (checkedForVictory.state.gameEndResults) {
          return checkedForVictory.state;
        }
        return _.flow(
          runCombat,
          presentOffenseChoices)(checkedForVictory).state;
      }
      return _.flow(
          pickOpponentOffenseCard,
          selectCard,
          playCards,
          presentDefenseChoices)({
            state,
            action,
          }).state;
    }
    default: return state;
  }
};

// store

function init(initialStateArg) {
  const gameApp = combineReducers({ game });
  const initialState = initialStateArg || undefined;
  store = createStore(gameApp, initialState);
  return store;
}

module.exports = {
  init,
  startGame,
  pickOffenseCard,
  pickDefenseCard,
  continueWithoutSelection,

  // exported for testing
  combatHelper,
};
