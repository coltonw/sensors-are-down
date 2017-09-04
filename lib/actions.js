// @flow
// eslint-disable-next-line node/no-unsupported-features
import type { Action, CardsObj } from './types';

let allCards;
if (process.env.WEBPACK) {
  // eslint-disable-next-line global-require
  allCards = require('../data/cards.yaml');
} else {
  // eslint-disable-next-line global-require
  allCards = require('../loaders/cards');
}

const START_GAME = 'START_GAME';
const PICK_OFFENSE_CARD = 'PICK_OFFENSE_CARD';
const PICK_DEFENSE_CARD = 'PICK_DEFENSE_CARD';
const CONTINUE_WITHOUT_SELECTION = 'CONTINUE_WITHOUT_SELECTION';

function startGame(includeCards: ?string[], allCardsArg: ?CardsObj): Action {
  return {
    type: START_GAME,
    allCards: allCardsArg || allCards,
    includeCards,
  };
}

function pickOffenseCard(cardId: string): Action {
  return {
    type: PICK_OFFENSE_CARD,
    cardId,
    player: 'player',
  };
}

function pickDefenseCard(cardId: string): Action {
  return {
    type: PICK_DEFENSE_CARD,
    cardId,
    player: 'player',
  };
}

function continueWithoutSelection(): Action {
  return {
    type: CONTINUE_WITHOUT_SELECTION,
    player: 'player',
  };
}

module.exports = {
  START_GAME,
  PICK_OFFENSE_CARD,
  PICK_DEFENSE_CARD,
  CONTINUE_WITHOUT_SELECTION,
  startGame,
  pickOffenseCard,
  pickDefenseCard,
  continueWithoutSelection,
};
