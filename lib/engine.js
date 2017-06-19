const { createStore, combineReducers } = require('redux');
const _ = require('lodash');

let store;

// engine

function validateCardChoice(choices, cardId) {
  return choices && choices[cardId] ? choices[cardId] : null;
}

function playCard(state) {
  // TODO: actually apply playing of a card
  return _.omit(state, 'card');
}

function pickOpponentCard(state) {
  // TODO: actually pick a card for opponent
  return {
    ...state,
  };
}

function presentDefenseChoices(state) {
  // TODO: actually apply choosing
  return {
    ...state,
  };
}

function runCombat(state) {
  // TODO: actually run combat
  return {
    ...state,
  };
}

// This function is definitely doing a little too much for being technically part of an "action"
// The problem I had hit was that a lot of the reducers that I would make to manage these various
// parts all need knowledge of the deck of cards, so they need to have a single reducer state.
// perhaps that is the real solution. This game just needs one single reducer so that they can
// all access the deck of cards as part of their reducing and then it can run more like I
// would expect.

// eslint-disable-next-line no-unused-vars
function runEngine(state, cardId) {
  // This is where we do all the magic
  // This state machine may be too complex for a reducer, but IDK

  if (state.offenseCardChoices) {
    const card = validateCardChoice(state.offenseCardChoices, cardId);
    if (!card) {
      return {
        ...state,
        offenseCardChoices: null,
        error: 'Illegal card choice',
      };
    }
    return _.flow(playCard, pickOpponentCard, presentDefenseChoices)({
      ...state,
      card,
    });
  } else if (state.defenseCardChoices) {
    const card = validateCardChoice(state.defenseCardChoices, cardId);
    if (!card) {
      return {
        ...state,
        defenseCardChoices: null,
        error: 'Illegal card choice',
      };
    }
    return _.flow(playCard, runCombat)({
      ...state,
      card,
    });
  }
  return {
    ...state,
    error: 'Engine should not have been run. What did you do?!?',
  };
}

// actions

const PICK_CARD = 'PICK_CARD';
function pickCard(cardId) {
  return (dispatch, getState) => {
    const newState = runEngine(getState(), cardId);
    dispatch({
      ...newState,
      type: PICK_CARD,
      cardId,
    });
  };
}

// reducers

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
};
const game = (state = gameInitialState, action) => {
  switch (action.type) {
    case PICK_CARD: {
      return _.omit(action, ['type', 'cardId']);
    }
    default: return state;
  }
};

const deckInitialState = {
  playerDeck: {},
  aiDeck: {},
};
const deck = (state = deckInitialState, action) => {
  switch (action.type) {
    case PICK_CARD: {
      const deckKey = action.player === 'ai' ? 'aiDeck' : 'playerDeck';
      const card = state[deckKey][action.cardId];
      // if this is the last copy of the card, delete it from the deck
      if (card.count <= 1) {
        return {
          ...state,
          [deckKey]: _.omit(state[deckKey], action.cardId),
        };
      }
      return {
        ...state,
        [deckKey]: {
          ...state[deckKey],
          [action.cardId]: {
            ...card,
            count: card.count - 1,
          },
        },
      };
    }
    default: return state;
  }
};

// store

function init(initialState) {
  const gameApp = combineReducers({ deck, game });
  store = createStore(gameApp, initialState);
}

function globalDispatch(action) {
  store.dispatch(action);
}

module.exports = {
  init,
  dispatch: globalDispatch,
  pickCard,
};
