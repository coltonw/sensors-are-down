require('babel-register');
const _ = require('lodash');
const fs = require('fs');
const jsYaml = require('js-yaml');
const path = require('path');
const allCards = require('../loaders/cards');
const engine = require('../lib/engine');

function sortObj(obj) {
  const keys = Object.keys(obj);
  keys.sort();
  return keys.reduce(
    (acc, key) =>
      _.assign({}, acc, { [key]: obj[key] }),
    {});
}

function runSingleGame(store) {
  let loops = 0;
  while (!store.getState().game.gameEndResults) {
    if (store.getState().game.defenseCardChoices) {
      const defensePick =
        _.sample(Object.keys(store.getState().game.defenseCardChoices.playerCards));
      if (defensePick) {
        store.dispatch(engine.pickDefenseCard(defensePick));
      } else {
        store.dispatch(engine.continueWithoutSelection());
      }
    } else if (store.getState().game.offenseCardChoices) {
      const offensePick =
        _.sample(Object.keys(store.getState().game.offenseCardChoices.playerCards));
      if (offensePick) {
        store.dispatch(engine.pickOffenseCard(offensePick));
      } else {
        store.dispatch(engine.continueWithoutSelection());
      }
    } else if (store.getState().game.error) {
      throw new Error(store.getState().game.error);
    }
    loops += 1;
    if (loops > 400) {
      console.dir(store.getState(), { depth: 5 });
      throw new Error('Infinite loop!');
    }
  }
  return store;
}

// ger for gameEndResults
function addGameEndResults(gerA = {}, gerB = {}) {
  return _.mergeWith({}, gerA, gerB, (valueA, valueB) => (valueA || 0) + (valueB || 0));
}

function recordStats(startState, endState, stats) {
  const cardComboIds = [];
  const cardIds = Object.keys(startState.game.playerDeck).sort();
  for (let i = 0; i < cardIds.length - 1; i += 1) {
    for (let j = i + 1; j < cardIds.length; j += 1) {
      cardComboIds.push(`${cardIds[i]}-${cardIds[j]}`);
    }
  }
  return _.assign({}, stats, {
    total: addGameEndResults(stats.total, endState.game.gameEndResults),
    cards: _.assign({}, stats.cards, _.mapValues(startState.game.playerDeck,
        (card, cardId) => addGameEndResults(stats.cards[cardId], endState.game.gameEndResults))),
    cardCombos: _.reduce(cardComboIds,
      (acc, comboId) => _.assign({}, acc, {
        [comboId]: addGameEndResults(stats.cardCombos[comboId], endState.game.gameEndResults),
      }),
      stats.cardCombos),
  });
}

function saveStats(statsArg) {
  const stats = statsArg;
  const aggregateResults = (cardResults) => {
    const numGames = _.sum(_.values(cardResults));
    return {
      victoryPct: _.round((((cardResults.playerShipVictory || 0) +
          (cardResults.playerPlanetVictory || 0) +
          (cardResults.playerTiebreakerVictory || 0)) / numGames) * 100, 1),
      defeatPct: _.round((((cardResults.playerShipDefeat || 0) +
          (cardResults.playerPlanetDefeat || 0) +
          (cardResults.playerTiebreakerDefeat || 0)) / numGames) * 100, 1),
      drawPct: _.round((((cardResults.drawShipsDestroyed || 0) +
          (cardResults.drawStalemate || 0)) / numGames) * 100, 1),
      shipPct: _.round((((cardResults.playerShipVictory || 0) +
          (cardResults.playerShipDefeat || 0)) / numGames) * 100, 1),
      planetPct: _.round((((cardResults.playerPlanetVictory || 0) +
          (cardResults.playerPlanetDefeat || 0) +
          (cardResults.playerTiebreakerVictory || 0) +
          (cardResults.playerTiebreakerDefeat || 0)) / numGames) * 100, 1),
      numGames,
    };
  };
  stats.totalOverview = aggregateResults(stats.total);
  stats.cards = sortObj(stats.cards);
  stats.cardOverview = sortObj(_.mapValues(stats.cards, aggregateResults));
  const cardComboOverview = sortObj(_.mapValues(stats.cardCombos, aggregateResults));
  // The overviews are way more interesting than these numbers
  delete stats.total;
  delete stats.cards;
  delete stats.cardCombos;
  fs.writeFileSync(path.resolve(__dirname, 'results.yml'), jsYaml.dump(stats));
  fs.writeFileSync(path.resolve(__dirname, 'resultsCombos.yml'), jsYaml.dump(cardComboOverview));
}

function simulateGames() {
  const numGames = parseInt(process.argv[2], 10) || 200;
  console.log(`Simulating ${numGames} games`);
  const includeCards = _.intersection(process.argv.slice(3), Object.keys(allCards));
  if (includeCards.length > 0) {
    console.log(`including ${includeCards.join(' and ')} in all player decks`);
  }
  let stats = {
    total: {},
    cards: {},
    cardCombos: {},
  };
  for (let i = 0; i < numGames; i += 1) {
    const store = engine.init();
    store.dispatch(engine.startGame(includeCards));
    const startState = store.getState();
    runSingleGame(store);
    const endState = store.getState();
    stats = recordStats(startState, endState, stats);
  }
  saveStats(stats, numGames);
}

simulateGames();
