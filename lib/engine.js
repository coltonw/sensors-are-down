// @flow
// eslint-disable-next-line
import type { State } from './types';
const { createStore, combineReducers } = require('redux');
const _ = require('lodash');
const { game: gameReducer } = require('./reducers');
const actions = require('./actions');
const unstackSpeech = require('./unstackSpeech');
const speeches = require('./speeches');

let log = console.log;
if (process.env.CLI_MODE) {
  log = () => {};
}

/*
  Note that Engine functions by their nature modify state. Expect state changing
  whenever you call functions in this file.
*/

let store;

function init(initialStateArg: ?State) {
  const gameApp = combineReducers({ game: gameReducer });
  const initialState = initialStateArg || undefined;
  store = createStore(gameApp, initialState);
  return store;
}

function hasChoice(state) {
  const cardChoices = speeches.getChoices(state);
  return cardChoices && Object.keys(cardChoices.playerCards).length > 0;
}

function run(messageSoFar: ?string, cliMode: ?boolean) {
  if (!cliMode) {
    log('Running engine');
  }
  let messages = messageSoFar ? [messageSoFar] : [];
  while (!hasChoice(store.getState()) && !store.getState().game.gameEndResults) {
    store.dispatch(actions.continueWithoutSelection());
    messages.push(speeches.describeRecentState);
    // since state is changing, we need to call all the speeches
    // with current state before it changes again.
    messages = [unstackSpeech(messages, store.getState())];
  }
  if (store.getState().game.gameEndResults) {
    log(JSON.stringify(store.getState().game.gameEndResults));
    messages.push(speeches.endOfGame);
  } else if (cliMode) {
    messages.push(speeches.pickACardCli);
  } else {
    messages.push(speeches.pickACard);
  }
  const speechObj = unstackSpeech(messages, store.getState());
  return speechObj;
}

function selectCard(cardSelected, cliMode: ?boolean) {
  const choices = speeches.getChoices(store.getState()) || { playerCards: {} };
  const match = _.find(Object.keys(choices.playerCards), cardId => (
      choices.playerCards[cardId].name.toLowerCase() === cardSelected.toLowerCase()
    ));
  log(`Card picked: ${match || ''}`);
  if (match && choices) {
    if (store.getState().game.defenseCardChoices) {
      store.dispatch(actions.pickDefenseCard(match));
    } else {
      store.dispatch(actions.pickOffenseCard(match));
    }
    const message = unstackSpeech(speeches.describeRecentState, store.getState());
    return run(message, cliMode);
  } else if (choices && Object.keys(choices.playerCards).length > 0) {
    return unstackSpeech(speeches.invalidCard, store.getState());
  }
  // TODO: real error handling
  return unstackSpeech([
    speeches.unknown,
  ], store.getState());
}

module.exports = {
  ...actions,
  init,
  selectCard,
  run,
  startGame: actions.startGame,
};
