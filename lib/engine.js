const { createStore, combineReducers } = require('redux');
const _ = require('lodash');

let store;

// actions

const START_GAME = 'START_GAME';
const PICK_OFFENSE_CARD = 'PICK_OFFENSE_CARD';
const PICK_DEFENSE_CARD = 'PICK_DEFENSE_CARD';

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

function validateCardChoice(choices, cardId) {
  return choices && choices[cardId] ? choices[cardId] : null;
}

function removeFromDeck({ state, action }) {
  const deckKey = action.player === 'ai' ? 'aiDeck' : 'playerDeck';
  const card = state[deckKey][action.cardId];
  // if this is the last copy of the card, delete it from the deck
  const updatedState = card.count <= 1 ? {
    ...state,
    [deckKey]: _.omit(state[deckKey], action.cardId),
  } : {
    ...state,
    [deckKey]: {
      ...state[deckKey],
      [action.cardId]: {
        ...card,
        count: card.count - 1,
      },
    },
  };
  return {
    state: updatedState,
    action,
    card,
  };
}

// play card helpers all pass the card all the way through
function playCards({ state, action }) {
  // TODO: actually apply playing of cards
  // in case it matters, cards are played "simultaneously"
  // if ordering matters, effects will have a specific order they run in
  // the cards are usually "played" by being added to the current state of
  // the ships and planet
  return { state, action };
}

function pickOpponentOffenseCard({ state, action }) {
  // TODO: actually pick a card for opponent
  // picks the card randomly and puts it in offenseCardChoices.aiCards
  return { state, action };
}

function pickOpponentDefenseCard({ state, action }) {
  // TODO: actually pick a card for opponent
  // picks the card randomly and puts it in defenseCardChoices.aiCards
  // this relies on offenseCardChoices.playerCards so that needs to be maintained
  // to this point
  return { state, action };
}

function presentOffenseChoices({ state, action }) {
  // TODO: actually apply choosing
  // defensive options are always based on the card that was played by your opponent
  return { state, action };
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
      return presentOffenseChoices({
        state: gameInitialState,
        action,
      });
    }
    case PICK_OFFENSE_CARD: {
      const card = validateCardChoice(state.offenseCardChoices.player, action.cardId);
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
        playCards,
        presentDefenseChoices)({
          state: {
            ...state,
            offenseCardChoices: {
              ...state.offenseCardChoices,
              playerCards: [card],
            },
          },
          action,
        }).state;
    }
    case PICK_DEFENSE_CARD: {
      const card = validateCardChoice(state.defenseCardChoices, action.cardId);
      if (!card) {
        return {
          ...state,
          offenseCardChoices: null,
          defenseCardChoices: null,
          error: 'Illegal card choice',
        };
      }
      return _.flow(
        removeFromDeck,
        pickOpponentDefenseCard,
        playCards,
        runCombat,
        presentOffenseChoices)({
          state: {
            ...state,
            defenseCardChoices: {
              ...state.defenseCardChoices,
              playerCards: [card],
            },
          },
          action,
        }).state;
    }
    default: return state;
  }
};

// store

function init(initialState) {
  const gameApp = combineReducers({ game });
  store = createStore(gameApp, initialState);
}

module.exports = {
  init,
  dispatch: store.dispatch,
  pickOffenseCard,
  pickDefenseCard,
};
