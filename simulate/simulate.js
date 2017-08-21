require('babel-register');
const _ = require('lodash');
const fs = require('fs');
const jsYaml = require('js-yaml');
const path = require('path');
const argv = require('yargs').boolean('ai').boolean('verbose').argv;
const readline = require('readline');
const cp = require('child_process');
const numCpus = require('os').cpus().length;
const allCards = require('../loaders/cards');

function sortObj(obj, sortedKeys) {
  let keys = sortedKeys;
  if (!keys) {
    keys = Object.keys(obj);
    keys.sort();
  }
  return keys.reduce(
    (acc, key) =>
      _.assign({}, acc, { [key]: obj[key] }),
    {});
}

// ger for gameEndResults
function addGameEndResults(gerA = {}, gerB = {}) {
  return _.mergeWith({}, gerA, gerB, (valueA, valueB) => (valueA || 0) + (valueB || 0));
}

function mergeStats(statsA, statsB) {
  return _.assign({}, statsA, statsB, {
    total: addGameEndResults(statsA.total, statsB.total),
    cards: _.assign({}, statsA.cards, _.mapValues(statsB.cards,
        (bCard, cardId) => addGameEndResults(statsA.cards[cardId], bCard))),
    cardCombos: _.assign({}, statsA.cardCombos, _.mapValues(statsB.cardCombos,
        (bCard, cardId) => addGameEndResults(statsA.cardCombos[cardId], bCard))),
    matchups: _.assign({}, statsA.matchups, _.mapValues(statsB.matchups,
        (bCard, cardId) => addGameEndResults(statsA.matchups[cardId], bCard))),
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
  const deadCardVictoryPct =
    stats.cardOverview.deadCard ? stats.cardOverview.deadCard.victoryPct || 0 : 0;
  delete stats.cards.deadCard;
  delete stats.cardOverview.deadCard;
  const cardsWithValues = _.mapValues(stats.cardOverview,
    cardSumm =>
      _.round((cardSumm.victoryPct - deadCardVictoryPct) /
      (stats.totalOverview.victoryPct - deadCardVictoryPct), 2));
  const cardRankings = _.fromPairs(
    _.sortBy(
      _.toPairs(cardsWithValues),
      cardValPair => -cardValPair[1]));
  const cardComboOverview = sortObj(_.mapValues(stats.cardCombos, aggregateResults));
  const matchupsOverview = sortObj(_.mapValues(stats.matchups, aggregateResults));
  // The overviews are way more interesting than these numbers
  delete stats.total;
  delete stats.cards;
  delete stats.cardCombos;
  delete stats.matchups;
  fs.writeFileSync(path.resolve(__dirname, 'results.yml'), jsYaml.dump(stats));
  fs.writeFileSync(path.resolve(__dirname, 'resultsRankings.yml'), jsYaml.dump(cardRankings));
  fs.writeFileSync(path.resolve(__dirname, 'resultsCombos.yml'), jsYaml.dump(cardComboOverview));
  fs.writeFileSync(path.resolve(__dirname, 'resultsMatchups.yml'), jsYaml.dump(matchupsOverview));
}

function simulateGames() {
  const numGames = parseInt(argv._[0], 10) || 200;
  console.log(`Simulating ${numGames} games${argv.ai ? ' using ai strategy' : ''}`);
  const includeArr = _.isArray(argv.include || []) ? argv.include || [] : [argv.include];
  const includeCards = _.intersection(includeArr, Object.keys(allCards));
  if (includeCards.length > 0) {
    console.log(`including ${includeCards.join(' and ')} in all player decks`);
  }
  let childArgs = [];
  if (argv.ai) {
    childArgs.push('--ai');
  }
  if (includeCards) {
    childArgs = [
      ...childArgs,
      ...includeCards.map(cardId => `--include=${cardId}`),
    ];
  }
  const children = [];
  let stats = {
    total: {},
    cards: {},
    cardCombos: {},
    matchups: {},
  };
  const onMessage = index => (m) => {
    if (typeof m === 'number') {
      children[index].gamesPlayed = m;
      const gamesPlayed = children.reduce((sum, childObj) => childObj.gamesPlayed + sum, 0);
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      console.log(`${gamesPlayed} games simulated`);
    } else {
      children[index].results = m;
      stats = mergeStats(stats, m);
      if (_.filter(children, childObj => childObj.results).length === children.length) {
        saveStats(stats, numGames);
      }
    }
  };
  for (let i = 0; i < numCpus; i += 1) {
    const child = cp.fork(`${__dirname}/simulateSubProcess.js`, [numGames / numCpus, ...childArgs]);
    children.push({
      process: child,
      results: null,
      gamesPlayed: 0,
    });
    child.on('message', onMessage(i));
  }

  console.log('');
}

simulateGames();
