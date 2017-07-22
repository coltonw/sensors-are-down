// @flow

// eslint-disable-next-line node/no-unsupported-features
import type { Action, CardsObj, Card, OtherState, Planet, PlayedCard, State, Zone, Zones } from './types';

const _ = require('lodash');
const shortid = require('shortid');
const { playSpecials } = require('./specials');
const actions = require('./actions');

// types specific to this filter

// eslint-disable-next-line node/no-unsupported-features
export type SubReducerObj = {
  state: State,
  action: Action,
};

// game engine reducer helpers

// filter a map of cards and then pick randomly from the filtered set
const pickRandomCards = (cardsObj: CardsObj, count = 1, filter: ?((card: Card) => ?boolean)) => {
  const allCardIds = Object.keys(cardsObj);
  // flow cannot handle the if statement around the whole arrow function
  // so now it is in the arrow function instead
  const filteredCardIds = _.filter(allCardIds,
      (cardId: string) => (filter ? filter(cardsObj[cardId]) : true));
  const cardIds = _.sampleSize(filteredCardIds, count);
  return cardIds.reduce((acc, cardId) => ({
    ...acc,
    [cardId]: cardsObj[cardId],
  }), {});
};

function createDecks({ state, action }: SubReducerObj): SubReducerObj {
  const playerDeck = pickRandomCards(action.allCards, 4);
  const aiDeck = pickRandomCards(action.allCards, 4);
  return {
    state: ({
      ...state,
      playerDeck,
      aiDeck,
    }: State),
    action,
  };
}

function validateCardChoice(choices, cardId) {
  return choices && choices[cardId] ? choices[cardId] : null;
}

function removeFromDeck({ state, action }: SubReducerObj): SubReducerObj {
  const deckKey = action.player === 'ai' ? 'aiDeck' : 'playerDeck';
  const card = state[deckKey][action.cardId];

  // count defaults to 1
  const cardCount = typeof card.count === 'number' ? card.count : 1;
  // if this is the last copy of the card, delete it from the deck
  const updatedState = cardCount <= 1 ? {
    ...state,
    [deckKey]: _.omit(state[deckKey], action.cardId),
  } : {
    ...state,
    [deckKey]: {
      ...state[deckKey],
      [action.cardId]: {
        ...card,
        count: cardCount - 1,
      },
    },
  };
  return {
    state: updatedState,
    action,
  };
}

function selectCard({ state, action }: SubReducerObj): SubReducerObj {
  if (state.defenseCardChoices) {
    return {
      state: ({
        ...state,
        defenseCardChoices: {
          ...state.defenseCardChoices,
          playerCards: _.pick(state.defenseCardChoices.playerCards, action.cardId),
        },
      }: State),
      action };
  } else if (state.offenseCardChoices) {
    return {
      state: ({
        ...state,
        offenseCardChoices: {
          ...state.offenseCardChoices,
          playerCards: _.pick(state.offenseCardChoices.playerCards, action.cardId),
        },
      }: State),
      action };
  }
  return {
    state,
    action };
}

function addCardDefaults(cardId: string, card: Card): PlayedCard {
  return {
    ...card,
    cardId,
    cardUid: shortid.generate(),
    strength: card.strength || 0,
  };
}

function playCardsHelper(ships, planet, playerCards, ship, cardChoices) {
  _.forEach(Object.keys(cardChoices[playerCards]), (cardId) => {
    const card = cardChoices[playerCards][cardId];
    if (card.planet) {
      // eslint-disable-next-line no-param-reassign
      planet = {
        ...planet,
        [playerCards]: [...planet[playerCards], addCardDefaults(cardId, card)],
      };
    } else if (card.space) {
      // eslint-disable-next-line no-param-reassign
      ships = {
        ...ships,
        [ship]: {
          ...ships[ship],
          [playerCards]: [...ships[ship][playerCards], addCardDefaults(cardId, card)],
        },
      };
    }
  });
  return {
    planet,
    ships,
  };
}

function playCards({ state: prePlayState, action }: SubReducerObj): SubReducerObj {
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

  return { state: {
    ...state,
    ships,
    planet,
  },
    action };
}

function pickOpponentOffenseCard({ state, action }: SubReducerObj): SubReducerObj {
  // picks the card randomly and puts it in offenseCardChoices.aiCards
  const stateWithPickedCards = { // using any here because of bugs with flow object spread :/
    ...(state: Zones & OtherState),
    offenseCardChoices: {
      ...state.offenseCardChoices,
      aiCards: pickRandomCards(state.aiDeck, 1, card => card.offense),
    },
  };
  if (Object.keys(stateWithPickedCards.offenseCardChoices.aiCards).length > 0) {
    return {
      state: removeFromDeck({
        state: ((stateWithPickedCards: any): State),
        action: {
          type: '',
          player: 'ai',
          cardId: Object.keys(stateWithPickedCards.offenseCardChoices.aiCards)[0],
        },
      }).state,
      action,
    };
  }
  return { state: ((stateWithPickedCards: any): State), action };
}

const defenseChoices = (state: State, myDeckKey: "aiDeck" | "playerDeck", myShipKey, opponentCardsKey) => {
  const oppPlayedCards = state.offenseCardChoices ? state.offenseCardChoices[opponentCardsKey] : {};
  const playCardZones = _.uniq(_.flatMap(Object.keys(oppPlayedCards),
    (cardId: string): string[] => {
      if (oppPlayedCards[cardId].space) {
        return ['space'];
      } else if (oppPlayedCards[cardId].planet) {
        return ['planet'];
      }
      return [];
    }));
  const defendShipsZones =
    state.ships[myShipKey][opponentCardsKey].length > 0 ? ['space'] : [];
  const defendPlanetZones =
    state.planet[opponentCardsKey].length > 0 ? ['planet'] : [];
  const zonesToDefend = _.union(playCardZones, defendShipsZones, defendPlanetZones);
  if (zonesToDefend.length === 0) {
    return {};
  } else if (zonesToDefend.length === 1) {
    return pickRandomCards(state[myDeckKey], 2,
        card => card.defense && card[zonesToDefend[0]]);
  }
  const spaceDefense = pickRandomCards(state[myDeckKey], 1,
        card => card.defense && card.space);
  if (Object.keys(spaceDefense).length === 0) {
    return pickRandomCards(state[myDeckKey], 2,
        card => card.defense && card.planet);
  }
  const planetDefense = pickRandomCards(state[myDeckKey], 1,
      card => card.defense && card.planet);
  if (Object.keys(planetDefense).length === 0) {
    return pickRandomCards(state[myDeckKey], 2,
        card => card.defense && card.space);
  }
  return {
    ...spaceDefense,
    ...planetDefense,
  };
};

function pickOpponentDefenseCard({ state, action }: SubReducerObj): SubReducerObj {
  // picks the card randomly and puts it in defenseCardChoices.aiCards
  // this relies on offenseCardChoices.playerCards so that needs to be maintained
  // to this point
  // TODO also pay attention to existing opponents cards on the ship or planet
  const stateWithPickedCards = {
    // workaround needed because of problems with object spread in flow
    // https://github.com/facebook/flow/issues/2816#issuecomment-297108820
    ...(state: Zones & OtherState),
    defenseCardChoices: {
      ...state.defenseCardChoices,
      aiCards: pickRandomCards(
        defenseChoices(state, 'aiDeck', 'aiShip', 'playerCards'),
        1),
    },
  };
  if (Object.keys(stateWithPickedCards.defenseCardChoices.aiCards).length > 0) {
    return {
      state: removeFromDeck({
        // workaround needed because of problems with object spread in flow
        state: ((stateWithPickedCards: any): State),
        action: {
          type: 'any',
          player: 'ai',
          cardId: Object.keys(stateWithPickedCards.defenseCardChoices.aiCards)[0],
        },
      }).state,
      action,
    };
  }
  return { state: ((stateWithPickedCards: any): State), action };
}

function presentOffenseChoices({ state, action }: SubReducerObj): SubReducerObj {
  return {
    state: ({
      ...state,
      offenseCardChoices: {
        ...state.offenseCardChoices,
        playerCards: pickRandomCards(state.playerDeck, 2, card => card.offense),
      },
      defenseCardChoices: null,
    }: State),
    action };
}

function presentDefenseChoices({ state, action }: SubReducerObj): SubReducerObj {
  // defensive options are always based on the card that was played by your opponent
  // or by existing opponents cards on the ship or planet
  return {
    state: ({
      ...state,
      defenseCardChoices: {
        ...state.defenseCardChoices,
        playerCards:
          defenseChoices(state, 'playerDeck', 'playerShip', 'aiCards'),
      },
    }: State),
    action };
}

function saveDefenseCardChoices({ state, action }: SubReducerObj): SubReducerObj {
  return {
    state: ({
      ...state,
      prevState: {
        ...state.prevState,
        offenseCardChoices: { ...state.offenseCardChoices },
        defenseCardChoices: { ...state.defenseCardChoices },
        ships: { ...state.ships },
        planet: { ...state.planet },
      },
    }: State),
    action,
  };
}


function getStrength(cards: PlayedCard[]) {
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

function checkForStalemate(state: State) {
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

function checkForVictory({ state, action }: SubReducerObj): SubReducerObj {
  const playerShipDamage = state.ships.playerShip.shipDamage +
    (state.ships.playerShip.playerCards.length === 0 && state.ships.playerShip.aiCards.length > 0 ?
      1 : 0);
  const aiShipDamage = state.ships.aiShip.shipDamage +
    (state.ships.aiShip.aiCards.length === 0 && state.ships.aiShip.playerCards.length > 0 ?
      1 : 0);
  const playerEntrenching = state.planet.aiCards.length === 0 &&
    state.planet.playerCards.length > 0;
  const aiEntrenching = state.planet.playerCards.length === 0 &&
    state.planet.aiCards.length > 0;
  if (playerShipDamage >= 2 && aiShipDamage < 2) {
    return {
      state: ({
        ...state,
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerShipDefeat: true,
        },
      }: State),
      action,
    };
  } else if (aiShipDamage >= 2 && playerShipDamage < 2) {
    return {
      state: ({
        ...state,
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerShipVictory: true,
        },
      }: State),
      action,
    };
  } else if (playerShipDamage < 2 && aiShipDamage < 2 &&
      playerEntrenching && state.planet.playerEntrenched) {
    return {
      state: ({
        ...state,
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerPlanetVictory: true,
        },
      }: State),
      action,
    };
  } else if (playerShipDamage < 2 && aiShipDamage < 2 &&
      aiEntrenching && state.planet.aiEntrenched) {
    return {
      state: ({
        ...state,
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          playerPlanetDefeat: true,
        },
      }: State),
      action,
    };
  } else if (playerShipDamage >= 2 && aiShipDamage >= 2) {
    const { strength: plStrength } = getStrength(state.planet.playerCards);
    const { strength: aiStrength } = getStrength(state.planet.aiCards);
    if (plStrength > aiStrength) {
      return {
        state: ({
          ...state,
          offenseCardChoices: null,
          defenseCardChoices: null,
          gameEndResults: {
            playerTiebreakerVictory: true,
          },
        }: State),
        action,
      };
    } else if (aiStrength > plStrength) {
      return {
        state: ({
          ...state,
          offenseCardChoices: null,
          defenseCardChoices: null,
          gameEndResults: {
            playerTiebreakerDefeat: true,
          },
        }: State),
        action,
      };
    }
    return {
      state: ({
        ...state,
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          drawShipsDestroyed: true,
        },
      }: State),
      action,
    };
  } if (checkForStalemate(state)) {
    return {
      state: ({
        ...state,
        offenseCardChoices: null,
        defenseCardChoices: null,
        gameEndResults: {
          drawStalemate: true,
        },
      }: State),
      action,
    };
  }
  return {
    state: ({
      ...state,
      ships: {
        ...state.ships,
        playerShip: {
          ...state.ships.playerShip,
          shipDamage: playerShipDamage,
        },
        aiShip: {
          ...state.ships.aiShip,
          shipDamage: aiShipDamage,
        },
      },
      planet: {
        ...state.planet,
        playerEntrenched: playerEntrenching || state.planet.playerEntrenched,
        aiEntrenched: aiEntrenching || state.planet.aiEntrenched,
      },
    }: State),
    action };
}

function damageCards(cards: PlayedCard[], damage: number): PlayedCard[] {
  return cards.reduce(({ damagedCards, damageLeft }, card) => {
    if (damageLeft >= card.strength || card.strength <= 0) {
      return { damagedCards, damageLeft: damageLeft - card.strength };
    }
    return {
      damagedCards: [
        ...damagedCards,
        {
          ...card,
          strength: card.strength - damageLeft,
        },
      ],
      damageLeft: 0,
    };
  }, { damagedCards: [], damageLeft: damage }).damagedCards;
}

function combatHelper<T: Zone>(zone: T): T {
  // long variable names so pl for player
  const { strength: plStrength,
    damageStrength: plDamageStr,
    shieldStrength: plShieldStr } = getStrength(zone.playerCards);
  const { strength: aiStrength,
    damageStrength: aiDamageStr,
    shieldStrength: aiShieldStr } = getStrength(zone.aiCards);
  const plShieldBonus = plStrength > aiStrength ? 1 : 0;
  const aiShieldBonus = plStrength < aiStrength ? 1 : 0;
  const plNewStrength = (plStrength + plShieldStr + plShieldBonus)
    - (aiStrength + aiDamageStr);
  const aiNewStrength = (aiStrength + aiShieldStr + aiShieldBonus)
    - (plStrength + plDamageStr);
  const plDamage = plStrength - plNewStrength > 0 ? plStrength - plNewStrength : 0;
  const aiDamage = aiStrength - aiNewStrength > 0 ? aiStrength - aiNewStrength : 0;
  const newPlCards = damageCards(zone.playerCards, plDamage);
  const newAiCards = damageCards(zone.aiCards, aiDamage);
  return {
    ...zone,
    playerCards: newPlCards,
    aiCards: newAiCards,
  };
}
// exported for testing purposes
exports.combatHelper = combatHelper;

function clearExtraEntrenchment(planet: Planet) {
  return {
    ...planet,
    playerEntrenched: planet.playerCards.length === 0 ? false : planet.playerEntrenched,
    aiEntrenched: planet.aiCards.length === 0 ? false : planet.aiEntrenched,
  };
}

function runCombat({ state, action }: SubReducerObj): SubReducerObj {
  const preCombatState = playSpecials('precombat', state);
  const postCombatState = {
    ...state,
    ships: {
      ...state.ships,
      playerShip: combatHelper(state.ships.playerShip),
      aiShip: combatHelper(state.ships.aiShip),
    },
    planet: clearExtraEntrenchment(combatHelper(state.planet)),
  };
  return {
    state: playSpecials('postcombat', (postCombatState: State), preCombatState),
    action,
  };
}

const gameInitialState: State = {
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

  prevState: {
    offenseCardChoices: null,
    defenseCardChoices: null,
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
  },

  // deck state
  playerDeck: {},
  aiDeck: {},
};

exports.game = (state: State = gameInitialState, action: any) => {
  switch (action.type) {
    case actions.START_GAME: {
      return _.flow(
        createDecks,
        presentOffenseChoices)({
          state: gameInitialState,
          action,
        }).state;
    }
    case actions.PICK_OFFENSE_CARD: {
      const card = validateCardChoice(state.offenseCardChoices ?
          state.offenseCardChoices.playerCards : null, action.cardId);
      if (!card) {
        return {
          ...state,
          offenseCardChoices: null,
          error: 'Illegal card choice',
        };
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
    case actions.PICK_DEFENSE_CARD: {
      const card = validateCardChoice(state.defenseCardChoices ?
          state.defenseCardChoices.playerCards : null, action.cardId);
      if (!card) {
        return {
          ...state,
          offenseCardChoices: null,
          defenseCardChoices: null,
          error: 'Illegal card choice',
        };
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
    case actions.CONTINUE_WITHOUT_SELECTION: {
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