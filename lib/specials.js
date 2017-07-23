// @flow
// eslint-disable-next-line node/no-unsupported-features
import type { PlayedCard, State, PlayedCardsMap } from './types';

const _ = require('lodash');


function getCurrentChoices(state: State) {
  if (state.defenseCardChoices) {
    return state.defenseCardChoices;
  } else if (state.offenseCardChoices) {
    return state.offenseCardChoices;
  }
  return null;
}

function planetaryBombers(state: State): State {
  const recentPlayerCardPlanet = _.last(state.planet.playerCards);
  const playerCards = recentPlayerCardPlanet && state.defenseCardChoices &&
    state.defenseCardChoices.playerCards[recentPlayerCardPlanet.cardId || ''] ? [recentPlayerCardPlanet] : [];
  const recentAiCardPlanet = _.last(state.planet.aiCards);
  const aiCards = recentAiCardPlanet && state.defenseCardChoices &&
    state.defenseCardChoices.aiCards[recentAiCardPlanet.cardId || ''] ? [recentAiCardPlanet] : [];
  return {
    ...state,
    planet: _.assign({}, state.planet, {
      playerCards,
      aiCards,
      playerEntrenched: false,
      aiEntrenched: false,
    }),
  };
}

function nanightStorm(state: State): State {
  const choices = getCurrentChoices(state);

  let playerDeck = state.playerDeck;
  if (choices && choices.playerCards.nanightStorm && state.playerDeck.nanightStorm) {
    const newStrength = playerDeck.nanightStorm.strength - 2;
    playerDeck = {
      ...playerDeck,
      nanightStorm: {
        ...playerDeck.nanightStorm,
        strength: newStrength,
        defense: false,
      },
    };
  }

  let aiDeck = state.aiDeck;
  if (choices && choices.aiCards.nanightStorm && state.aiDeck.nanightStorm) {
    const newStrength = aiDeck.nanightStorm.strength - 2;
    aiDeck = {
      ...aiDeck,
      nanightStorm: {
        ...aiDeck.nanightStorm,
        strength: newStrength,
        defense: false,
      },
    };
  }

  return {
    ...state,
    playerDeck,
    aiDeck,
  };
}

function scrapHarvestersZone(preCombatZone, zone) {
  const playerDeaths = preCombatZone.playerCards.length > zone.playerCards.length;
  const aiDeaths = preCombatZone.aiCards.length > zone.aiCards.length;
  return {
    ...zone,
    playerCards: _.map(zone.playerCards,
      (card) => {
        if (card.cardId === 'scrapHarvesters' && aiDeaths) {
          return {
            ...card,
            strength: card.strength + 1,
          };
        }
        return card;
      }),
    aiCards: _.map(zone.aiCards,
      (card) => {
        if (card.cardId === 'scrapHarvesters' && playerDeaths) {
          return {
            ...card,
            strength: card.strength + 1,
          };
        }
        return card;
      }),
  };
}

function scrapHarvesters(preCombatState, state) {
  return {
    ...state,
    ships: {
      ...state.ships,
      playerShip: scrapHarvestersZone(
        preCombatState.ships.playerShip,
        state.ships.playerShip),
      aiShip: scrapHarvestersZone(
        preCombatState.ships.aiShip,
        state.ships.aiShip),
    },
    planet: scrapHarvestersZone(preCombatState.planet, state.planet),
  };
}

const graveyard = (cardsBefore: PlayedCard[], cardsAfter: PlayedCard[]): PlayedCard[] =>
  _.differenceBy(cardsBefore, cardsAfter, card => card.cardUid);

function reanimatingSliversZone(preCombatZone, zone) {
  const playerSliversRevived = _.flatMap(graveyard(preCombatZone.playerCards, zone.playerCards),
    (card: PlayedCard): PlayedCard[] =>
      (card.zombie ? [] : [{ ...card, zombie: true, strength: 2 }]));
  const playerCards = _.concat(zone.playerCards, playerSliversRevived);
  const aiSliversRevived = _.flatMap(graveyard(preCombatZone.aiCards, zone.aiCards),
    (card: PlayedCard): PlayedCard[] =>
      (card.zombie ? [] : [{ ...card, zombie: true, strength: 2 }]));
  const aiCards = _.concat(zone.aiCards, aiSliversRevived);
  return {
    ...zone,
    playerCards,
    aiCards,
  };
}

function reanimatingSlivers(preCombatState, state) {
  return {
    ...state,
    ships: {
      ...state.ships,
      playerShip: reanimatingSliversZone(
        preCombatState.ships.playerShip,
        state.ships.playerShip),
      aiShip: reanimatingSliversZone(
        preCombatState.ships.aiShip,
        state.ships.aiShip),
    },
    planet: reanimatingSliversZone(preCombatState.planet, state.planet),
  };
}

function trenchFighters(state: State): PlayedCardsMap {
  const playerTrenchFighters = _.reduce(state.planet.playerCards,
    (acc, card) => {
      if (card.cardId === 'trenchFighters') {
        return {
          ...acc,
          [card.cardUid]: {
            ...card,
            strength: card.strength + (state.planet.playerEntrenched ? 1 : 0),
            shieldStrength: state.planet.playerEntrenched ? 1 : 0,
          },
        };
      }
      return acc;
    }, {});
  const aiTrenchFighters = _.reduce(state.planet.aiCards,
    (acc, card) => {
      if (card.cardId === 'trenchFighters') {
        return {
          ...acc,
          [card.cardUid]: {
            ...card,
            strength: card.strength + (state.planet.aiEntrenched ? 1 : 0),
            shieldStrength: state.planet.aiEntrenched ? 1 : 0,
          },
        };
      }
      return acc;
    }, {});
  return {
    ...playerTrenchFighters,
    ...aiTrenchFighters,
  };
}

const strengthSpecials: { [string]: ((State) => PlayedCardsMap) } = {
  trenchFighters,
};

const specials = {
  planetaryBombers,
  nanightStorm,
};

const otherStateSpecials = {
  scrapHarvesters,
  reanimatingSlivers,
};

type Phase = 'preplaycards' | 'precombat' | 'postcombat' | 'strength';

function getCombattingSpecials(phase: Phase, state: State, otherState: ?State) {
  const getZoneSpecialIds = zone => _.flatMap(_.concat(zone.playerCards, zone.aiCards),
      (card: PlayedCard): string[] => (card.special === phase ? [card.cardId] : []));
  const emptyZone = {
    playerCards: [],
    aiCards: [],
  };
  return _.union(
    getZoneSpecialIds(state.ships.playerShip),
    getZoneSpecialIds(state.ships.aiShip),
    getZoneSpecialIds(state.planet),
    getZoneSpecialIds(otherState ? otherState.ships.playerShip : emptyZone),
    getZoneSpecialIds(otherState ? otherState.ships.aiShip : emptyZone),
    getZoneSpecialIds(otherState ? otherState.planet : emptyZone));
}

// otherState will be precombat state during postcombat phase
function playSpecials(phase: Phase, state: State, otherState: ?State) {
  const choices = getCurrentChoices(state);
  // This may need to be ammended as things get more complicated
  // including adding specials data to the state and such
  let specialIds = [];
  if (choices && _.includes(['preplaycards', 'precombat'], phase)) {
    const playerSpecialIds = Object.keys(choices.playerCards).filter(
      cardId => choices.playerCards[cardId].special === phase);
    const aiSpecialIds = Object.keys(choices.aiCards).filter(
      cardId => choices.aiCards[cardId].special === phase);
    specialIds = _.union(playerSpecialIds, aiSpecialIds);
  } else if (_.includes(['postcombat'], phase)) {
    specialIds = getCombattingSpecials(phase, state, otherState);
  }
  const currentSpecials = _.flatMap(specialIds,
      (cardId: string): ((state: State) => State)[] => {
        if (specials[cardId]) {
          return [specials[cardId]];
        } else if (otherStateSpecials[cardId]) {
          return [_.bind(otherStateSpecials[cardId], null, otherState)];
        }
        return [];
      });
  return _.flow(currentSpecials)(state, otherState);
}

function getSpecialStrength(state: State): PlayedCardsMap {
  const specialIds = getCombattingSpecials('strength', state);
  const currentSpecials = _.flatMap(specialIds,
      (cardId: string): ((state: State) => PlayedCardsMap)[] => {
        if (strengthSpecials[cardId]) {
          return [strengthSpecials[cardId]];
        }
        return [];
      });
  return currentSpecials.reduce((acc, special) => ({
    ...acc,
    ...special(state),
  }), {});
}

module.exports = {
  playSpecials,
  getSpecialStrength,
};
