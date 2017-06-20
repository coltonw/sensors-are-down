const { createStore, combineReducers } = require('redux');
const _ = require('lodash');

let store;

// actions

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

function removeFromDeck({ state, action, card }) {
  const deckKey = action.player === 'ai' ? 'aiDeck' : 'playerDeck';
  const cardInDeck = state[deckKey][action.cardId];
  // if this is the last copy of the card, delete it from the deck
  const updatedState = cardInDeck.count <= 1 ? {
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

function playCard({ state, action, card }) {
  // TODO: actually apply playing of a card
  return { state, action, card };
}

function pickOpponentOffenseCard({ state, action, card }) {
  // TODO: actually pick a card for opponent
  return { state, action, card };
}

function pickOpponentDefenseCard({ state, action, card }) {
  // TODO: actually pick a card for opponent
  return { state, action, card };
}

function presentDefenseChoices({ state, action, card }) {
  // TODO: actually apply choosing
  return { state, action, card };
}

function runCombat({ state, action, card }) {
  // TODO: actually run combat
  return { state, action, card };
}

const gameInitialState = {
  // this is an implicit state machine.
  // if any of the following choices are NOT null,
  // that is the current state
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
    case PICK_OFFENSE_CARD: {
      const card = validateCardChoice(state.offenseCardChoices, action.cardId);
      if (!card) {
        return {
          ...state,
          offenseCardChoices: null,
          error: 'Illegal card choice',
        };
      }
      return _.flow(removeFromDeck, playCard, pickOpponentOffenseCard, presentDefenseChoices)({
        state,
        action,
        card,
      }).state;
    }
    case PICK_DEFENSE_CARD: {
      const card = validateCardChoice(state.defenseCardChoices, action.cardId);
      if (!card) {
        return {
          ...state,
          defenseCardChoices: null,
          error: 'Illegal card choice',
        };
      }
      return _.flow(removeFromDeck, playCard, pickOpponentDefenseCard, runCombat)({
        state,
        action,
        card,
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

function globalDispatch(action) {
  store.dispatch(action);
}

module.exports = {
  init,
  dispatch: globalDispatch,
  pickOffenseCard,
  pickDefenseCard,
};
