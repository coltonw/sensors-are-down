const { createStore, combineReducers } = require('redux');
const omit = require('lodash').omit;

let store;

// engine

// eslint-disable-next-line no-unused-vars
function runEngine(state, cardId) {
  // This is where we do all the magic
  // This state machine will be a bit too complex for reducers I think?
  return state;
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
      return omit(action, ['type', 'cardId']);
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
          [deckKey]: omit(state[deckKey], action.cardId),
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
