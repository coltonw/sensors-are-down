// @flow
// eslint-disable-next-line
import type { State } from './types';
const { createStore, combineReducers } = require('redux');
const { game: gameReducer } = require('./reducers');
const actions = require('./actions');

let store;

function init(initialStateArg: ?State) {
  const gameApp = combineReducers({ game: gameReducer });
  const initialState = initialStateArg || undefined;
  store = createStore(gameApp, initialState);
  return store;
}

module.exports = {
  ...actions,
  init,
  startGame: actions.startGame,
  pickOffenseCard: actions.pickOffenseCard,
  pickDefenseCard: actions.pickDefenseCard,
  continueWithoutSelection: actions.continueWithoutSelection,
};
