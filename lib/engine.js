const { createStore, combineReducers } = require('redux');
const _ = require('lodash');
const config = require('config');

let store;

// actions

const START_GAME = 'START_GAME';
const PICK_OFFENSE_CARD = 'PICK_OFFENSE_CARD';
const PICK_DEFENSE_CARD = 'PICK_DEFENSE_CARD';

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

// reducers

// game engine reducer helpers

// UGH. No object spread operators!!!

// filter a map of cards and then pick randomly from the filtered set
const pickRandomCards = (cardsObj, count = 1, filter) => {
  const allCardIds = Object.keys(cardsObj);
  const filteredCardIds = filter ?
    _.filter(allCardIds, cardId => filter(cardsObj[cardId])) : allCardIds;
  const cardIds = _.take(_.shuffle(filteredCardIds), count);
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
  // if this is the last copy of the card, delete it from the deck
  const updatedState = card.count <= 1 ? _.assign({}, state, {
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
    card,
  };
}

function playCards({ state, action }) {
  // TODO: actually play cards
  // in case it matters, cards are played "simultaneously"
  // if ordering matters, effects will have a specific order they run in
  // the cards are usually "played" by being added to the current state of
  // the ships and planet
  return { state, action };
}

function pickOpponentOffenseCard({ state, action }) {
  // picks the card randomly and puts it in offenseCardChoices.aiCards
  return {
    state: _.assign({}, state, {
      offenseCardChoices: _.assign({}, state.offenseCardChoices, {
        aiCards: pickRandomCards(state.playerDeck, 1, card => card.offense),
      }),
    }),
    action };
}

function pickOpponentDefenseCard({ state, action }) {
  // TODO: actually pick a card for opponent
  // picks the card randomly and puts it in defenseCardChoices.aiCards
  // this relies on offenseCardChoices.playerCards so that needs to be maintained
  // to this point
  return { state, action };
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
  // TODO: actually apply choosing
  // defensive options are always based on the card that was played by your opponent
  return { state, action };
}

function runCombat({ state, action }) {
  // TODO: actually run combat
  // runs combat based on current state of both ships and the planet
  return { state, action };
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
    },
    aiShips: {
      playerCards: [],
      aiCards: [],
    },
  },
  planet: {
    playerCards: [],
    aiCards: [],
  },

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
        playCards,
        presentDefenseChoices)({
          state: _.assign({}, state, {
            offenseCardChoices: _.assign({}, state.offenseCardChoices, {
              playerCards: [card],
            }),
          }),
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
      return _.flow(
        removeFromDeck,
        pickOpponentDefenseCard,
        playCards,
        runCombat,
        presentOffenseChoices)({
          state: _.assign({}, state, {
            defenseCardChoices: _.assign({}, state.defenseCardChoices, {
              playerCards: [card],
            }),
          }),
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
};
