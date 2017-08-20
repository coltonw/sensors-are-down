// @flow
// eslint-disable-next-line node/no-unsupported-features
import type { Card, CardsObj, PlayedCard, PlayedCardsMap, SpecialVictory, State } from './types';

const _ = require('lodash');

// Special utils

function getCurrentChoicesKey(state: State): ('defenseCardChoices' | 'offenseCardChoices' | null) {
  if (state.defenseCardChoices) {
    return 'defenseCardChoices';
  } else if (state.offenseCardChoices) {
    return 'offenseCardChoices';
  }
  return null;
}

function getCurrentChoices(state: State) {
  const key = getCurrentChoicesKey(state);
  if (key) {
    return state[key];
  }
  return null;
}

function deleteDevelopment(state: State, developmentId: string): State {
  const choiceKey = getCurrentChoicesKey(state);
  if (choiceKey && state[choiceKey]) {
    const newPlayerCards = _.omit(state[choiceKey].playerCards, developmentId);
    // $FlowFixMe
    const newAiCards = _.omit(state[choiceKey].aiCards, developmentId);
    return {
      ...state,
      [choiceKey]: {
        ...state[choiceKey],
        playerCards: newPlayerCards,
        aiCards: newAiCards,
      },
    };
  }
  return state;
}

const graveyard = (cardsBefore: PlayedCard[], cardsAfter: PlayedCard[]): PlayedCard[] =>
  _.differenceBy(cardsBefore, cardsAfter, card => card.cardUid);

function generateCard(obj: CardsObj, cardId: string, card: Card, count: number): CardsObj {
  return {
    ...obj,
    [cardId]: {
      ...(obj[cardId] ?
        obj[cardId] :
        card),
      count: (count * (card.count || 1)) +
        (obj[cardId] ?
          obj[cardId].count || 1 :
          0),
    },
  };
}

function strengthHelper(
  state: State,
  cardId: string,
  playerFn: (PlayedCard) => PlayedCard,
  aiFn: (PlayedCard) => PlayedCard): PlayedCardsMap {
  const playerCards = _.concat(
    state.ships.playerShip.playerCards,
    state.ships.aiShip.playerCards,
    state.planet.playerCards);
  const playerHash = _.reduce(playerCards,
    (acc, card) => {
      if (card.cardId === cardId) {
        return {
          ...acc,
          [card.cardUid]: playerFn(card),
        };
      }
      return acc;
    }, {});
  const aiCards = _.concat(
    state.ships.playerShip.aiCards,
    state.ships.aiShip.aiCards,
    state.planet.aiCards);
  const aiHash = _.reduce(aiCards,
    (acc, card) => {
      if (card.cardId === cardId) {
        return {
          ...acc,
          [card.cardUid]: aiFn(card),
        };
      }
      return acc;
    }, {});
  return {
    ...playerHash,
    ...aiHash,
  };
}

function cardsArrToCardsObj(
  cards: PlayedCard[],
  allCards: CardsObj,
  cardsObj: CardsObj = {}): CardsObj {
  return cards.reduce((acc, { cardId }) => {
    if (acc[cardId]) {
      return {
        ...acc,
        [cardId]: {
          ...acc[cardId],
          count: (acc[cardId].count || 1) + 1,
        },
      };
    } else if (allCards[cardId]) {
      return {
        ...acc,
        [cardId]: {
          ...allCards[cardId],
          count: 1,
        },
      };
    }
    return acc;
  }, cardsObj);
}

// Special functions

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

function scrapHoppers(state: State): State {
  const choicesKey = getCurrentChoicesKey(state);
  if (choicesKey) {
    const playerShipDead = state.ships.playerShip.playerGraveyard.length +
       state.ships.playerShip.aiGraveyard.length;
    const aiShipDead = state.ships.aiShip.playerGraveyard.length +
      state.ships.aiShip.aiGraveyard.length;
    if (choicesKey === 'offenseCardChoices' && state.offenseCardChoices) {
      return {
        ...state,
        offenseCardChoices: {
          ...state.offenseCardChoices,
          playerCards: _.mapValues(state.offenseCardChoices.playerCards, (card, cardId) =>
            (cardId === 'scrapHoppers' ?
            {
              ...card,
              strength: card.strength + aiShipDead,
            } :
            card)),
          // $FlowFixMe
          aiCards: _.mapValues(state.offenseCardChoices.aiCards, (card, cardId) =>
            (cardId === 'scrapHoppers' ?
            {
              ...card,
              strength: card.strength + playerShipDead,
            } :
            card)),
        },
      };
    } else if (choicesKey === 'defenseCardChoices' && state.defenseCardChoices) {
      return {
        ...state,
        defenseCardChoices: {
          ...state.defenseCardChoices,
          playerCards: _.mapValues(state.defenseCardChoices.playerCards, (card, cardId) =>
            (cardId === 'scrapHoppers' ?
            {
              ...card,
              strength: card.strength + playerShipDead,
            } :
            card)),
          // $FlowFixMe I don't know why this is not an error above but is one here
          aiCards: _.mapValues(state.defenseCardChoices.aiCards, (card, cardId) =>
            (cardId === 'scrapHoppers' ?
            {
              ...card,
              strength: card.strength + aiShipDead,
            } :
            card)),
        },
      };
    }
  }
  return state;
}

function nanightStorm(state: State): State {
  const choices = getCurrentChoices(state);

  let playerDeck = state.playerDeck;
  if (choices && choices.playerCards.nanightStorm && state.playerDeck.nanightStorm) {
    const newStrength = playerDeck.nanightStorm.strength - 1;
    playerDeck = {
      ...playerDeck,
      nanightStorm: {
        ...playerDeck.nanightStorm,
        strength: newStrength,
      },
    };
  }

  let aiDeck = state.aiDeck;
  if (choices && choices.aiCards.nanightStorm && state.aiDeck.nanightStorm) {
    const newStrength = aiDeck.nanightStorm.strength - 1;
    aiDeck = {
      ...aiDeck,
      nanightStorm: {
        ...aiDeck.nanightStorm,
        strength: newStrength,
      },
    };
  }

  return {
    ...state,
    playerDeck,
    aiDeck,
  };
}

function moltenSawTower(state: State): State {
  const choices = getCurrentChoices(state);

  let playerDeck = state.playerDeck;
  if (choices && choices.playerCards.moltenSawTower && state.playerDeck.moltenSawTower) {
    const newStrength = playerDeck.moltenSawTower.strength + 3;
    playerDeck = {
      ...playerDeck,
      moltenSawTower: {
        ...playerDeck.moltenSawTower,
        strength: newStrength,
      },
    };
  }

  let aiDeck = state.aiDeck;
  if (choices && choices.aiCards.moltenSawTower && state.aiDeck.moltenSawTower) {
    const newStrength = aiDeck.moltenSawTower.strength + 3;
    aiDeck = {
      ...aiDeck,
      moltenSawTower: {
        ...aiDeck.moltenSawTower,
        strength: newStrength,
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

function staccatoFlyers(state) {
  const playerShipDamage = state.ships.playerShip.playerCards.reduce(
    (acc, card) =>
      (acc + card.strength), 0) <= 1 &&
    _.filter(state.ships.playerShip.aiCards,
      card =>
        card.cardId === 'staccatoFlyers' && card.strength >= 2).length > 0;
  const aiShipDamage = state.ships.aiShip.aiCards.reduce(
    (acc, card) => (acc + card.strength), 0) <= 1 &&
      _.filter(state.ships.aiShip.playerCards,
        card =>
          card.cardId === 'staccatoFlyers' && card.strength >= 2).length > 0;
  return {
    playerShipDamage,
    aiShipDamage,
  };
}

function reanimatingSliversZone(preCombatZone, zone) {
  const playerSliversRevived = _.flatMap(graveyard(preCombatZone.playerCards, zone.playerCards),
    (card: PlayedCard): PlayedCard[] =>
      (card.cardId === 'reanimatingSlivers' && (!card.raw || !card.raw.zombie) ? [{ ...card, raw: { zombie: true }, strength: 2 }] : []));
  const playerSliversMap = playerSliversRevived.reduce(
    (acc, card) => ({ ...acc, [card.cardUid]: true }), {});
  const playerCards = _.concat(zone.playerCards, playerSliversRevived);
  const playerGraveyard = _.filter(zone.playerGraveyard, card => !playerSliversMap[card.cardUid]);
  const aiSliversRevived = _.flatMap(graveyard(preCombatZone.aiCards, zone.aiCards),
    (card: PlayedCard): PlayedCard[] =>
      (card.cardId === 'reanimatingSlivers' && (!card.raw || !card.raw.zombie) ? [{ ...card, raw: { zombie: true }, strength: 2 }] : []));
  const aiSliversMap = playerSliversRevived.reduce(
    (acc, card) => ({ ...acc, [card.cardUid]: true }), {});
  const aiGraveyard = _.filter(zone.playerGraveyard, card => !aiSliversMap[card.cardUid]);
  const aiCards = _.concat(zone.aiCards, aiSliversRevived);
  return {
    ...zone,
    playerCards,
    aiCards,
    playerGraveyard,
    aiGraveyard,
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

function treeOfTheStars(preCombatState, state) {
  const playerRecentlyDead = [
    ...graveyard(preCombatState.ships.playerShip.playerCards, state.ships.playerShip.playerCards),
    ...graveyard(preCombatState.ships.aiShip.playerCards, state.ships.aiShip.playerCards),
  ];
  const playerNumDeadTrees = _.filter(playerRecentlyDead,
    (card: PlayedCard): boolean => (card.cardId === 'treeOfTheStars')).length;
  let playerDeck = state.playerDeck;
  if (playerNumDeadTrees > 0) {
    playerDeck = generateCard(playerDeck, 'starSplinters', state.allCards.starSplinters, playerNumDeadTrees);
  }
  const aiRecentlyDead = [
    ...graveyard(preCombatState.ships.playerShip.aiCards, state.ships.playerShip.aiCards),
    ...graveyard(preCombatState.ships.aiShip.aiCards, state.ships.aiShip.aiCards),
  ];
  const aiNumDeadTrees = _.filter(aiRecentlyDead,
    (card: PlayedCard): boolean => (card.cardId === 'treeOfTheStars')).length;
  let aiDeck = state.aiDeck;
  if (aiNumDeadTrees > 0) {
    aiDeck = generateCard(aiDeck, 'starSplinters', state.allCards.starSplinters, aiNumDeadTrees);
  }
  return {
    ...state,
    playerDeck,
    aiDeck,
  };
}

function bubbleFactory(state: State): State {
  const playerNumBubbleFactories = _.filter(state.planet.playerCards, card => card.cardId === 'bubbleFactory').length;
  let playerDeck = state.playerDeck;
  if (playerNumBubbleFactories > 0) {
    playerDeck = generateCard(playerDeck, 'bubbleShuttles', state.allCards.bubbleShuttles, playerNumBubbleFactories);
    playerDeck = generateCard(playerDeck, 'bubbleBots', state.allCards.bubbleBots, playerNumBubbleFactories);
  }
  const aiNumBubbleFactories = _.filter(state.planet.playerCards, card => card.cardId === 'bubbleFactory').length;
  let aiDeck = state.aiDeck;
  if (aiNumBubbleFactories > 0) {
    aiDeck = generateCard(aiDeck, 'bubbleShuttles', state.allCards.bubbleShuttles, aiNumBubbleFactories);
    aiDeck = generateCard(aiDeck, 'bubbleBots', state.allCards.bubbleBots, aiNumBubbleFactories);
  }
  return {
    ...state,
    playerDeck,
    aiDeck,
  };
}

function sporeSoldiers(state) {
  const choicesKey = getCurrentChoicesKey(state);
  const choices = getCurrentChoices(state);
  if (choices && choicesKey) {
    const playerDeadSpores = _.filter(
      state.planet.playerGraveyard,
      (card: PlayedCard): boolean =>
        card.cardId === 'sporeSoldiers').length;
    const playerCards = _.mapValues(choices.playerCards,
      card =>
        (card.tribe === 'plant' && card.planet ?
        {
          ...card,
          strength: card.strength + playerDeadSpores,
        } :
          card));

    const aiDeadSpores = _.filter(
      state.planet.aiGraveyard,
      (card: PlayedCard): boolean =>
        card.cardId === 'sporeSoldiers').length;
    const aiCards = _.mapValues(choices.aiCards,
      card =>
        (card.tribe === 'plant' && card.planet ?
        {
          ...card,
          strength: card.strength + aiDeadSpores,
        } :
          card));
    return {
      ...state,
      [choicesKey]: {
        ...choices,
        playerCards,
        aiCards,
      },
    };
  }

  return state;
}

function seedPodDropper(state: State): State {
  const choicesKey = getCurrentChoicesKey(state);
  const choices = getCurrentChoices(state);
  if (choices && choicesKey) {
    let playerCards = choices.playerCards;
    if (playerCards.seedPodDropper) {
      playerCards = {
        ...playerCards,
        seedPod: {
          ...state.allCards.seedPod,
        },
      };
    }

    let aiCards = choices.aiCards;
    if (aiCards.seedPodDropper) {
      aiCards = {
        ...aiCards,
        seedPod: {
          ...state.allCards.seedPod,
        },
      };
    }
    return {
      ...state,
      [choicesKey]: {
        ...choices,
        playerCards,
        aiCards,
      },
    };
  }

  return state;
}

function puffingPlant(state: State): PlayedCardsMap {
  return strengthHelper(state,
    'puffingPlant',
    card => ({
      ...card,
      damageStrength: state.planet.aiCards.length,
      shieldStrength: state.planet.aiCards.length,
    }),
    card => ({
      ...card,
      damageStrength: state.planet.playerCards.length,
      shieldStrength: state.planet.playerCards.length,
    }));
}

function trenchFighters(state: State): PlayedCardsMap {
  return strengthHelper(state,
    'trenchFighters',
    card => ({
      ...card,
      damageStrength: state.planet.playerEntrenched ? 1 : 0,
      shieldStrength: state.planet.playerEntrenched ? 2 : 0,
    }),
    card => ({
      ...card,
      damageStrength: state.planet.aiEntrenched ? 1 : 0,
      shieldStrength: state.planet.aiEntrenched ? 2 : 0,
    }));
}

function reinforcedGleam(state: State): State {
  const choices = getCurrentChoices(state);
  const reinforce = card =>
    (card.tribe === 'bubble' ?
    {
      ...card,
      armorStrength: (card.armorStrength || 0) + 4,
    } :
    card);
  let playerDeck = state.playerDeck;
  if (choices && choices.playerCards.reinforcedGleam) {
    playerDeck = _.mapValues(playerDeck, reinforce);
  }
  let aiDeck = state.aiDeck;
  if (choices && choices.aiCards.reinforcedGleam) {
    aiDeck = _.mapValues(aiDeck, reinforce);
  }
  const developedState: State = {
    ...state,
    playerDeck,
    aiDeck,
  };
  return deleteDevelopment(developedState, 'reinforcedGleam');
}

function scrapReanimator(state: State): State {
  const choices = getCurrentChoices(state);
  let playerDeck = state.playerDeck;
  if (choices && choices.playerCards.scrapReanimator) {
    const allPlayerGraveyards = _.concat(
      state.ships.playerShip.playerGraveyard,
      state.ships.aiShip.playerGraveyard,
      state.planet.playerGraveyard);
    const allPlayerDeadScrap = _.filter(allPlayerGraveyards, ({ tribe }) => tribe === 'scrap');
    playerDeck = cardsArrToCardsObj(allPlayerDeadScrap, state.allCards, playerDeck);
  }
  let aiDeck = state.aiDeck;
  if (choices && choices.aiCards.scrapReanimator) {
    const allAiGraveyards = _.concat(
      state.ships.playerShip.aiGraveyard,
      state.ships.aiShip.aiGraveyard,
      state.planet.aiGraveyard);
    const allAiDeadScrap = _.filter(allAiGraveyards, ({ tribe }) => tribe === 'scrap');
    aiDeck = cardsArrToCardsObj(allAiDeadScrap, state.allCards, aiDeck);
  }
  const developedState: State = {
    ...state,
    playerDeck,
    aiDeck,
  };
  return deleteDevelopment(developedState, 'scrapReanimator');
}

function hoverTanks(state: State): State {
  const hoverTheTank = card =>
    (card.cardId === 'hoverTanks' && (!card.raw || !card.raw.hovering) ?
    {
      ...card,
      raw: {
        hovering: true,
      },
      strength: Math.max(card.strength, 3),
    } :
    card);
  return {
    ...state,
    planet: {
      ...state.planet,
      playerCards: _.map(state.planet.playerCards, hoverTheTank),
      aiCards: _.map(state.planet.aiCards, hoverTheTank),
    },
  };
}

const strengthSpecials: { [string]: ((State) => PlayedCardsMap) } = {
  trenchFighters,
  puffingPlant,
};

const specials = {
  planetaryBombers,
  nanightStorm,
  scrapHoppers,
  moltenSawTower,
  reinforcedGleam,
  hoverTanks,
  bubbleFactory,
  seedPodDropper,
  sporeSoldiers,
  scrapReanimator,
};

const victorySpecials: { [string]: ((State) => SpecialVictory) } = {
  staccatoFlyers,
};

const otherStateSpecials = {
  scrapHarvesters,
  reanimatingSlivers,
  treeOfTheStars,
};

type Phase = 'preplaycards' | 'precombat' | 'postcombat' | 'strength' | 'checkforvictory';

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

function getGraveyardSpecials(phase: Phase, state: State): string[] {
  const getZoneSpecialIds = zone => _.flatMap(_.concat(zone.playerGraveyard, zone.aiGraveyard),
      (card: PlayedCard): string[] => (card.special === `graveyard-${phase}` ? [card.cardId] : []));
  return _.union(
    getZoneSpecialIds(state.ships.playerShip),
    getZoneSpecialIds(state.ships.aiShip),
    getZoneSpecialIds(state.planet));
}

// otherState will be precombat state during postcombat phase
function playSpecials(phase: Phase, state: State, otherState: ?State) {
  const choices = getCurrentChoices(state);
  // This may need to be ammended as things get more complicated
  // including adding specials data to the state and such
  let specialIds = [];
  if (choices && _.includes(['preplaycards', 'precombat'], phase)) {
    const playerSpecialIds = Object.keys(choices.playerCards).filter(
      cardId =>
        choices.playerCards[cardId].special === phase ||
        (choices.playerCards[cardId].development && phase === 'preplaycards'));
    const aiSpecialIds = Object.keys(choices.aiCards).filter(
      cardId =>
        choices.aiCards[cardId].special === phase ||
        (choices.aiCards[cardId].development && phase === 'preplaycards'));
    specialIds = _.union(playerSpecialIds, aiSpecialIds);
  } else if (_.includes(['postcombat'], phase)) {
    specialIds = getCombattingSpecials(phase, state, otherState);
  }
  // check for graveyard effects
  specialIds = [...specialIds, ...getGraveyardSpecials(phase, state)];

  const currentSpecials = _.flatMap(specialIds,
      (cardId: string): ((state: State) => State)[] => {
        if (specials[cardId]) {
          return [specials[cardId]];
        } else if (otherStateSpecials[cardId]) {
          // bind here just makes it so the otherStateSpecials bind the first arg,
          // of each of them to otherState so that they behave the same as normal specials,
          // taking state as input and returning state as output.
          return [_.bind(otherStateSpecials[cardId], null, otherState)];
        }
        return [];
      });
  return _.flow(currentSpecials)(state);
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

function checkSpecialVictory(state: State): SpecialVictory {
  const specialIds = getCombattingSpecials('checkforvictory', state);
  const currentSpecials = _.flatMap(specialIds,
      (cardId: string): ((state: State) => SpecialVictory)[] => {
        if (victorySpecials[cardId]) {
          return [victorySpecials[cardId]];
        }
        return [];
      });
  return currentSpecials.reduce((acc, special) => {
    const victories = special(state);
    return {
      playerShipDamage: acc.playerShipDamage || victories.playerShipDamage,
      aiShipDamage: acc.aiShipDamage || victories.aiShipDamage,
      playerEntrenching: acc.playerEntrenching || victories.playerEntrenching,
      aiEntrenching: acc.aiEntrenching || victories.aiEntrenching,
    };
  }, {});
}

module.exports = {
  checkSpecialVictory,
  playSpecials,
  getSpecialStrength,
};
