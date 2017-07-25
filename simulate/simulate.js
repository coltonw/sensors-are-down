require('babel-register');
const _ = require('lodash');
const config = require('config');
const fs = require('fs');
const jsYaml = require('js-yaml');
const path = require('path');
const engine = require('../lib/engine');

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
  return _.assign({}, stats, {
    total: addGameEndResults(stats.total, endState.game.gameEndResults),
    cards: _.assign({}, stats.cards, _.mapValues(startState.game.playerDeck,
        (card, cardId) => addGameEndResults(stats.cards[cardId], endState.game.gameEndResults))),
  });
}

function saveStats(stats) {
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
  // eslint-disable-next-line no-param-reassign
  stats.totalOverview = aggregateResults(stats.total);
  // eslint-disable-next-line no-param-reassign
  stats.cardOverview = _.mapValues(stats.cards, aggregateResults);
  fs.writeFileSync(path.resolve(__dirname, 'results.yml'), jsYaml.dump(stats));
}

function simulateGames() {
  const numGames = parseInt(process.argv[2], 10) || 200;
  console.log(`Simulating ${numGames} games`);
  const includeCards = _.intersection(process.argv.slice(3), Object.keys(config.cards));
  if (includeCards.length > 0) {
    console.log(`including ${includeCards.join(' and ')} in all player decks`);
  }
  let stats = {
    total: {},
    cards: {},
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
