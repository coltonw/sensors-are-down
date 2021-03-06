// @flow

// eslint-disable-next-line node/no-unsupported-features
import type { Action, CardsObj, Card, OtherState, Planet, PlayedCard, PlayedCardsMap, State, Zone, Zones } from './types';

const _ = require('lodash');
const shortid = require('shortid');
const { checkSpecialVictory, getSpecialStrength, playSpecials } = require('./specials');
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

const pickRandomPrioritized = (
  cardsObj: CardsObj,
  count: number,
  priorityKey: string,
  filter: ((card: Card) => ?boolean)) => {
  const highFilter = card => card[priorityKey] === 'high' && filter(card);
  const normalFilter = card => !card[priorityKey] && filter(card);
  const lowFilter = card => card[priorityKey] === 'low' && filter(card);
  const highCards = pickRandomCards(cardsObj, count, highFilter);
  const normalCards = pickRandomCards(cardsObj,
    count - Object.keys(highCards).length, normalFilter);
  const lowCards = pickRandomCards(cardsObj,
    count - Object.keys(highCards).length - Object.keys(normalCards).length, lowFilter);
  return {
    ...highCards,
    ...normalCards,
    ...lowCards,
  };
};

// This makes sure the deck is not totally garbage
function validDeck(deck: CardsObj): boolean {
  const shipDefenseCards = _.filter(Object.keys(deck),
    cardId =>
      deck[cardId].space && deck[cardId].defense);
  const landCards = _.filter(Object.keys(deck), cardId => deck[cardId].land);
  const developmentTribes = _.flatMap(_.values(deck),
    (card: Card): string[] => (card.development && card.tribe ?
      [card.tribe] :
      []));
  const nonDevelopmentTribeCounts = _.values(deck).reduce(
    (acc, card) =>
      (card.tribe && !card.development ?
      {
        ...acc,
        [card.tribe]: 1 + (acc[card.tribe] || 0),
      } :
      acc), {});
  return shipDefenseCards.length >= 2 && landCards.length >= 2 &&
    _.every(developmentTribes,
      tribe =>
      nonDevelopmentTribeCounts[tribe] && nonDevelopmentTribeCounts[tribe] >= 2);
}

function createDecks({ state, action }: SubReducerObj): SubReducerObj {
  let playerDeck = pickRandomCards(action.allCards, 6, card => !card.generated);
  while (!validDeck(playerDeck) || (action.includeCards &&
      _.intersection(Object.keys(playerDeck), action.includeCards).length <
      action.includeCards.length)) {
    playerDeck = pickRandomCards(action.allCards, 6, card => !card.generated);
  }
  let aiDeck = pickRandomCards(action.allCards, 6, card => !card.generated);
  while (!validDeck(aiDeck)) {
    aiDeck = pickRandomCards(action.allCards, 6, card => !card.generated);
  }
  return {
    state: ({
      ...state,
      playerDeck,
      aiDeck,
      allCards: action.allCards,
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

function addCardDefaults(cardId: string, card: Card,
  currentTurn: number, currentPhase): PlayedCard {
  return {
    ...card,
    cardId,
    cardUid: shortid.generate(),
    strength: card.strength || 0,
    turnPlayed: currentTurn,
    phasePlayed: currentPhase,
  };
}

function playCardsHelper(ships, planet, playerCards, ship, cardChoices, currentTurn, currentPhase) {
  _.forEach(Object.keys(cardChoices[playerCards]), (cardId) => {
    const card = cardChoices[playerCards][cardId];
    if (card.land) {
      // eslint-disable-next-line no-param-reassign
      planet = {
        ...planet,
        [playerCards]: card.tank ?
          [addCardDefaults(cardId, card, currentTurn, currentPhase), ...planet[playerCards]] :
          [...planet[playerCards], addCardDefaults(cardId, card, currentTurn, currentPhase)],
      };
    } else if (card.space) {
      // eslint-disable-next-line no-param-reassign
      ships = {
        ...ships,
        [ship]: {
          ...ships[ship],
          [playerCards]: card.tank ?
          [addCardDefaults(cardId, card, currentTurn, currentPhase),
            ...ships[ship][playerCards]] :
            [...ships[ship][playerCards], addCardDefaults(cardId, card, currentTurn, currentPhase)],
        },
      };
    }
  });
  return {
    planet,
    ships,
  };
}

function shyAway(cards) {
  return {
    remain: _.filter(cards, card => !card.shy),
    shy: _.filter(cards, card => card.shy),
  };
}

function shyShips(state: State): State {
  let playerShipPlayerCards = state.ships.playerShip.playerCards;
  let playerShipAiCards = state.ships.playerShip.aiCards;
  let aiShipPlayerCards = state.ships.aiShip.playerCards;
  let aiShipAiCards = state.ships.aiShip.aiCards;
  if (state.defenseCardChoices) {
    const shyAwayAiOnPlayerShip = _.filter(
      _.values(state.defenseCardChoices.playerCards),
      card => card.space).length > 0;
    if (shyAwayAiOnPlayerShip) {
      const { remain, shy } = shyAway(playerShipAiCards);
      playerShipAiCards = remain;
      aiShipAiCards = [...aiShipAiCards, ...shy];
    }
    const shyAwayPlayerOnAiShip = _.filter(
      // $FlowFixMe
      _.values(state.defenseCardChoices.aiCards),
      card => card.space).length > 0;
    if (shyAwayPlayerOnAiShip) {
      const { remain, shy } = shyAway(aiShipPlayerCards);
      aiShipPlayerCards = remain;
      playerShipPlayerCards = [...aiShipAiCards, ...shy];
    }
  } else if (state.offenseCardChoices) {
    const shyAwayAiOnAiShip = _.filter(
      _.values(state.offenseCardChoices.playerCards),
      card => card.space).length > 0;
    if (shyAwayAiOnAiShip) {
      const { remain, shy } = shyAway(aiShipAiCards);
      aiShipAiCards = remain;
      playerShipAiCards = [...aiShipAiCards, ...shy];
    }
    const shyAwayPlayerOnPlayerShip = _.filter(
      // $FlowFixMe
      _.values(state.offenseCardChoices.aiCards),
      card => card.space).length > 0;
    if (shyAwayPlayerOnPlayerShip) {
      const { remain, shy } = shyAway(playerShipPlayerCards);
      playerShipPlayerCards = remain;
      aiShipPlayerCards = [...aiShipAiCards, ...shy];
    }
  }
  return {
    ...state,
    ships: {
      ...state.ships,
      playerShip: {
        ...state.ships.playerShip,
        playerCards: playerShipPlayerCards,
        aiCards: playerShipAiCards,
      },
      aiShip: {
        ...state.ships.aiShip,
        playerCards: aiShipPlayerCards,
        aiCards: aiShipAiCards,
      },
    },
  };
}

const chargeCard = card => (
  typeof card.recharging === 'number' && card.recharging > 0 ?
  {
    ...card,
    recharging: card.recharging - 1,
  } :
  card);

function playCards({ state: prePlayState, action }: SubReducerObj): SubReducerObj {
  // in case it matters, cards are played "simultaneously"
  // if ordering matters, effects will have a specific order they run in
  // the cards are usually "played" by being added to the current state of
  // the ships and planet
  const preplayedSpecialsState = playSpecials('preplaycards', prePlayState);
  const state = shyShips(preplayedSpecialsState);
  let ships = state.ships;
  let planet = state.planet;
  let playerDeck = _.mapValues(state.playerDeck, chargeCard);
  let aiDeck = _.mapValues(state.aiDeck, chargeCard);
  if (state.defenseCardChoices) {
    const playerHelperResult = playCardsHelper(ships, planet, 'playerCards', 'playerShip', state.defenseCardChoices, state.currentTurn, 'defense');
    ships = playerHelperResult.ships;
    planet = playerHelperResult.planet;
    // $FlowFixMe
    const aiHelperResult = playCardsHelper(ships, planet, 'aiCards', 'aiShip', state.defenseCardChoices, state.currentTurn, 'defense');
    ships = aiHelperResult.ships;
    planet = aiHelperResult.planet;
    playerDeck = _.mapValues(playerDeck,
      (card, cardId) =>
        // $FlowFixMe
        (state.defenseCardChoices.playerCards[cardId] && card.recharge ?
        {
          ...card,
          recharging: card.recharge,
        } :
          card));
    aiDeck = _.mapValues(aiDeck,
      (card, cardId) =>
        // $FlowFixMe
        (state.defenseCardChoices.aiCards[cardId] && card.recharge ?
        {
          ...card,
          recharging: card.recharge,
        } :
          card));
  } else if (state.offenseCardChoices) {
    const playerHelperResult = playCardsHelper(ships, planet, 'playerCards', 'aiShip', state.offenseCardChoices, state.currentTurn, 'offense');
    ships = playerHelperResult.ships;
    planet = playerHelperResult.planet;
    // $FlowFixMe
    const aiHelperResult = playCardsHelper(ships, planet, 'aiCards', 'playerShip', state.offenseCardChoices, state.currentTurn, 'offense');
    ships = aiHelperResult.ships;
    planet = aiHelperResult.planet;
    playerDeck = _.mapValues(playerDeck,
      (card, cardId) =>
        // $FlowFixMe
        (state.offenseCardChoices.playerCards[cardId] && card.recharge ?
        {
          ...card,
          recharging: card.recharge,
        } :
          card));
    aiDeck = _.mapValues(aiDeck,
      (card, cardId) =>
        // $FlowFixMe
        (state.offenseCardChoices.aiCards[cardId] && card.recharge ?
        {
          ...card,
          recharging: card.recharge,
        } :
          card));
  }
  // $FlowFixMe
  return { state: {
    ...state,
    ships,
    planet,
    playerDeck,
    aiDeck,
  },
    action };
}

function pickOpponentOffenseCard({ state, action }: SubReducerObj): SubReducerObj {
  // picks the card randomly and puts it in offenseCardChoices.aiCards
  const stateWithPickedCards = { // using any here because of bugs with flow object spread :/
    ...(state: Zones & OtherState),
    offenseCardChoices: {
      ...state.offenseCardChoices,
      aiCards: pickRandomPrioritized(state.aiDeck, 1, 'offensePriority', card => card.offense && !card.recharging),
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
      } else if (oppPlayedCards[cardId].land) {
        return ['land'];
      }
      return [];
    }));
  const defendShipsZones =
    state.ships[myShipKey][opponentCardsKey].length > 0 ? ['space'] : [];
  const defendPlanetZones =
    state.planet[opponentCardsKey].length > 0 ? ['land'] : [];
  const zonesToDefend = _.union(playCardZones, defendShipsZones, defendPlanetZones);
  let zoneDefense = {};
  if (zonesToDefend.length === 1) {
    zoneDefense = pickRandomPrioritized(state[myDeckKey], 2, 'defensePriority',
        card => card.defense && card[zonesToDefend[0]] && !card.recharging);
  } else if (zonesToDefend.length === 2) {
    const spaceDefense = pickRandomPrioritized(state[myDeckKey], 1, 'defensePriority',
          card => card.defense && card.space && !card.recharging);
    const planetDefense = pickRandomPrioritized(state[myDeckKey], 1, 'defensePriority',
        card => card.defense && card.land && !card.recharging);
    if (Object.keys(spaceDefense).length === 0) {
      zoneDefense = pickRandomPrioritized(state[myDeckKey], 2, 'defensePriority',
          card => card.defense && card.land && !card.recharging);
    } else if (Object.keys(planetDefense).length === 0) {
      zoneDefense = pickRandomPrioritized(state[myDeckKey], 2, 'defensePriority',
          card => card.defense && card.space && !card.recharging);
    } else {
      zoneDefense = {
        ...spaceDefense,
        ...planetDefense,
      };
    }
  }
  const development = pickRandomPrioritized(state[myDeckKey], 1, 'defensePriority',
      card => card.development && !card.recharging);
  return {
    ...zoneDefense,
    ...development,
  };
};

function pickOpponentDefenseCard({ state, action }: SubReducerObj): SubReducerObj {
  // picks the card randomly and puts it in defenseCardChoices.aiCards
  // this relies on offenseCardChoices.playerCards so that needs to be maintained
  // to this point
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
        playerCards: pickRandomPrioritized(state.playerDeck, 2, 'offensePriority', card => card.offense && !card.recharging),
      },
      defenseCardChoices: null,
      currentTurn: state.currentTurn + 1,
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


function getStrength(cards: PlayedCard[], specialStrength: PlayedCardsMap) {
  return cards.reduce((curr, rawCard) => {
    let card = rawCard;
    if (specialStrength[card.cardUid]) {
      card = specialStrength[card.cardUid];
    }
    return {
      strength: curr.strength + (!card.recharging ? card.strength : 0),
      damageStrength: curr.damageStrength +
        (card.damageStrength && !card.recharging ? card.damageStrength : 0),
      shieldStrength: curr.shieldStrength + (card.shieldStrength || 0),
    };
  }, {
    strength: 0,
    damageStrength: 0,
    shieldStrength: 0,
  });
}

function damageCards(cards: PlayedCard[], damage: number): [PlayedCard[], PlayedCard[]] {
  const damageResults = cards.reduce(({ damagedCards, graveyard, damageLeft }, card) => {
    const armorStrength = card.armorStrength || 0;
    if (damageLeft >= card.strength + armorStrength || card.strength <= 0) {
      return {
        damagedCards,
        graveyard: [
          ...graveyard,
          {
            ...card,
            strength: 0,
            armorStrength: 0,
          },
        ],
        damageLeft: damageLeft - (card.strength + armorStrength),
      };
    }
    const newArmorStrength = Math.max(armorStrength - damageLeft, 0);
    // Math.min here prevents adding strength when there is more armor than damageLeft
    const newStrength = Math.min(card.strength, card.strength - (damageLeft - armorStrength));
    return {
      damagedCards: [
        ...damagedCards,
        {
          ...card,
          strength: newStrength,
          armorStrength: newArmorStrength,
        },
      ],
      graveyard,
      damageLeft: 0,
    };
  }, { damagedCards: [], graveyard: [], damageLeft: damage });
  return [damageResults.damagedCards, damageResults.graveyard];
}

function combatHelper<T: Zone>(zone: T, specialStrength: PlayedCardsMap): T {
  // long variable names so pl for player
  const { strength: plStrength,
    damageStrength: plDamageStr,
    shieldStrength: plShieldStr } = getStrength(zone.playerCards, specialStrength);
  const { strength: aiStrength,
    damageStrength: aiDamageStr,
    shieldStrength: aiShieldStr } = getStrength(zone.aiCards, specialStrength);
  const plShieldBonus = plStrength > aiStrength ? 1 : 0;
  const aiShieldBonus = plStrength < aiStrength ? 1 : 0;
  const plNewStrength = (plStrength + plShieldStr + plShieldBonus)
    - (aiStrength + aiDamageStr);
  const aiNewStrength = (aiStrength + aiShieldStr + aiShieldBonus)
    - (plStrength + plDamageStr);
  const plDamage = plStrength - plNewStrength > 0 ? plStrength - plNewStrength : 0;
  const aiDamage = aiStrength - aiNewStrength > 0 ? aiStrength - aiNewStrength : 0;
  const [newPlCards, newPlGrave] = damageCards(zone.playerCards, plDamage);
  const [newAiCards, newAiGrave] = damageCards(zone.aiCards, aiDamage);
  return {
    ...zone,
    playerCards: newPlCards.map(chargeCard),
    aiCards: newAiCards.map(chargeCard),
    playerGraveyard: [...zone.playerGraveyard, ...newPlGrave],
    aiGraveyard: [...zone.aiGraveyard, ...newAiGrave],
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
  const specialStrength = getSpecialStrength(preCombatState);
  const postCombatState = {
    ...preCombatState,
    ships: {
      ...preCombatState.ships,
      playerShip: combatHelper(preCombatState.ships.playerShip, specialStrength),
      aiShip: combatHelper(preCombatState.ships.aiShip, specialStrength),
    },
    planet: clearExtraEntrenchment(combatHelper(preCombatState.planet, specialStrength)),
  };
  return {
    state: playSpecials('postcombat', (postCombatState: State), preCombatState),
    action,
  };
}
// exported for testing purposes
exports.runCombat = runCombat;

function checkForStalemate(state: State) {
  const activePlayerCards = _.some(Object.keys(state.playerDeck),
      cardId => state.playerDeck[cardId].offense);
  const activeAiCards = _.some(Object.keys(state.aiDeck),
      cardId => state.aiDeck[cardId].offense);
  // check for if combat is stalling
  // (cards with high defense that can't kill each other)

  const checkIfEmpty = (zone, cardsToCheck) =>
      _.every(cardsToCheck, cards => zone[cards].length === 0);

  if (!activePlayerCards && !activeAiCards) {
    const postCombatState = runCombat({ state, action: { type: '' } }).state;
    const checkStalemate = (zone, postCombatZone) =>
      (postCombatZone.playerCards.length > 0 && postCombatZone.aiCards.length > 0 &&
      _.isEqual(zone.playerCards, postCombatZone.playerCards) &&
      _.isEqual(zone.aiCards, postCombatZone.aiCards));
    if ((checkIfEmpty(state.planet, ['playerCards', 'aiCards']) || checkStalemate(state.planet, postCombatState.planet)) &&
        (checkIfEmpty(state.ships.playerShip, ['aiCards']) || checkStalemate(state.ships.playerShip, postCombatState.ships.playerShip)) &&
        (checkIfEmpty(state.ships.aiShip, ['playerCards']) || checkStalemate(state.ships.aiShip, postCombatState.ships.aiShip))) {
      return true;
    }
  }
  return false;
}

function checkForVictory({ state, action }: SubReducerObj): SubReducerObj {
  const specialVictory = checkSpecialVictory(state);
  const numActiveCards = cards => _.filter(cards, card => !card.recharging).length;
  const playerShipDamage = state.ships.playerShip.shipDamage +
    ((state.ships.playerShip.playerCards.length === 0 &&
      numActiveCards(state.ships.playerShip.aiCards) > 0) ||
      specialVictory.playerShipDamage ?
      1 : 0);
  const aiShipDamage = state.ships.aiShip.shipDamage +
    ((state.ships.aiShip.aiCards.length === 0 &&
      numActiveCards(state.ships.aiShip.playerCards) > 0) ||
      specialVictory.aiShipDamage ?
      1 : 0);
  const playerEntrenching = (state.planet.aiCards.length === 0 &&
    numActiveCards(state.planet.playerCards) > 0) ||
    specialVictory.playerEntrenching;
  const aiEntrenching = (state.planet.playerCards.length === 0 &&
    numActiveCards(state.planet.aiCards) > 0) ||
    specialVictory.aiEntrenching;
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
    const specialStrength = getSpecialStrength(state);
    const { strength: plStrength } = getStrength(state.planet.playerCards, specialStrength);
    const { strength: aiStrength } = getStrength(state.planet.aiCards, specialStrength);
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
      playerGraveyard: [],
      aiGraveyard: [],
      shipDamage: 0,
    },
    aiShip: {
      playerCards: [],
      aiCards: [],
      playerGraveyard: [],
      aiGraveyard: [],
      shipDamage: 0,
    },
  },
  planet: {
    playerCards: [],
    aiCards: [],
    playerGraveyard: [],
    aiGraveyard: [],
    playerEntrenched: false,
    aiEntrenched: false,
  },

  currentTurn: 0,

  prevState: {
    offenseCardChoices: null,
    defenseCardChoices: null,
    ships: {
      playerShip: {
        playerCards: [],
        aiCards: [],
        playerGraveyard: [],
        aiGraveyard: [],
        shipDamage: 0,
      },
      aiShip: {
        playerCards: [],
        aiCards: [],
        playerGraveyard: [],
        aiGraveyard: [],
        shipDamage: 0,
      },
    },
    planet: {
      playerCards: [],
      aiCards: [],
      playerGraveyard: [],
      aiGraveyard: [],
      playerEntrenched: false,
      aiEntrenched: false,
    },
  },

  // deck state
  playerDeck: {},
  aiDeck: {},

  allCards: {},
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
