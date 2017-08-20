require('babel-register');
const _ = require('lodash');
const fs = require('fs');
const jsYaml = require('js-yaml');
const path = require('path');
const argv = require('yargs').boolean('ai').boolean('verbose').argv;
const readline = require('readline');
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

const pick = (cards, useAi, state) => {
  if (useAi) {
    const early = _.sample(_.filter(Object.keys(cards),
      cardId => cards[cardId].strategy === 'early'));
    if (early) {
      return early;
    }
    const safe = _.sample(_.filter(Object.keys(cards),
      cardId => cards[cardId].strategy === 'safe'));
    if (safe &&
        state.ships.playerShip.playerCards.length > 0 &&
        state.planet.playerCards.length > 0) {
      return safe;
    }
    const notLateCards = _.filter(Object.keys(cards),
      cardId => cards[cardId].strategy !== 'late' && cards[cardId].strategy !== 'safe');
    if (notLateCards.length > 0) {
      const shipCard = _.sample(_.filter(notLateCards, cardId => cards[cardId].space));
      const planetCard = _.sample(_.filter(notLateCards, cardId => cards[cardId].planet));
      if (state.defenseCardChoices) {
        // AI on defense
        if (state.planet.playerCards.length === 0 && state.planet.aiEntrenched && planetCard) {
          return planetCard;
        } else if (state.ships.playerShip.playerCards.length === 0 &&
            state.ships.playerShip.shipDamage && shipCard) {
          return shipCard;
        } else if (state.planet.playerCards.length === 0 && planetCard) {
          return planetCard;
        } else if (state.ships.playerShip.playerCards.length === 0 && shipCard) {
          return shipCard;
        }
      } else {
        // AI on offense
        const offenseCard = _.sample(_.filter(notLateCards, cardId => !cards[cardId].defense));
        if (offenseCard) {
          return offenseCard;
        }
        const shipDefCount = _.filter(_.values(state.playerDeck),
          card => card.space && card.defense).length;
        const planetDefCount = _.filter(_.values(state.playerDeck),
          card => card.planet && card.defense).length;
        if (planetCard && planetDefCount > shipDefCount) {
          return planetCard;
        } else if (shipCard && shipDefCount > planetDefCount) {
          return shipCard;
        }
      }
      return _.sample(notLateCards);
    }
  }
  return _.sample(Object.keys(cards));
};

function runSingleGame(store, useAi, verbose) {
  let loops = 0;
  let round = 0;
  while (!store.getState().game.gameEndResults) {
    if (store.getState().game.defenseCardChoices) {
      const defensePick =
        pick(store.getState().game.defenseCardChoices.playerCards,
          useAi,
          store.getState().game);
      if (defensePick) {
        store.dispatch(engine.pickDefenseCard(defensePick));
      } else {
        store.dispatch(engine.continueWithoutSelection());
      }
      round += 1;
    } else if (store.getState().game.offenseCardChoices) {
      const offensePick =
        pick(store.getState().game.offenseCardChoices.playerCards,
          useAi,
          store.getState().game);
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
  if (verbose) {
    const endRes = store.getState().game.gameEndResults;
    const victory = endRes.playerShipVictory ||
        endRes.playerPlanetVictory ||
        endRes.playerTiebreakerVictory;
    console.log(`Game ended after ${round} rounds${victory ? ' in victory' : ''}`);
    /* console.dir(_.assign({},
      store.getState().game.ships, {
        planet: store.getState().game.planet,
      }), { depth: 6 }); */
  }
  return store;
}

// ger for gameEndResults
function addGameEndResults(gerA = {}, gerB = {}) {
  return _.mergeWith({}, gerA, gerB, (valueA, valueB) => (valueA || 0) + (valueB || 0));
}

function recordStats(startState, endState, stats) {
  const cardComboIds = [];
  const matchupIds = [];
  const cardIds = Object.keys(startState.game.playerDeck).sort();
  for (let i = 0; i < cardIds.length - 1; i += 1) {
    for (let j = i + 1; j < cardIds.length; j += 1) {
      cardComboIds.push(`${cardIds[i]}-${cardIds[j]}`);
    }
  }
  const aiCardIds = Object.keys(startState.game.aiDeck).sort();
  for (let i = 0; i < cardIds.length; i += 1) {
    for (let j = 0; j < aiCardIds.length; j += 1) {
      matchupIds.push(`${cardIds[i]}-vs-${aiCardIds[j]}`);
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
    matchups: _.reduce(matchupIds,
      (acc, matchupId) => _.assign({}, acc, {
        [matchupId]: addGameEndResults(stats.matchups[matchupId], endState.game.gameEndResults),
      }),
      stats.matchups),
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
  const matchupsOverview = sortObj(_.mapValues(stats.matchups, aggregateResults));
  // The overviews are way more interesting than these numbers
  delete stats.total;
  delete stats.cards;
  delete stats.cardCombos;
  delete stats.matchups;
  fs.writeFileSync(path.resolve(__dirname, 'results.yml'), jsYaml.dump(stats));
  fs.writeFileSync(path.resolve(__dirname, 'resultsCombos.yml'), jsYaml.dump(cardComboOverview));
  fs.writeFileSync(path.resolve(__dirname, 'resultsMatchups.yml'), jsYaml.dump(matchupsOverview));
}

function simulateGames() {
  const numGames = parseInt(argv._[0], 10) || 200;
  console.log(`Simulating ${numGames} games${argv.ai ? ' using ai strategy' : ''}`);
  const includeCards = _.intersection(argv.include, Object.keys(allCards));
  if (includeCards.length > 0) {
    console.log(`including ${includeCards.join(' and ')} in all player decks`);
  }
  let stats = {
    total: {},
    cards: {},
    cardCombos: {},
    matchups: {},
  };
  console.log('');
  for (let i = 0; i < numGames; i += 1) {
    const store = engine.init();
    store.dispatch(engine.startGame(includeCards));
    const startState = store.getState();
    runSingleGame(store, argv.ai, argv.verbose);
    const endState = store.getState();
    stats = recordStats(startState, endState, stats);
    if ((i + 1) % 100 === 0) {
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      console.log(`${(i + 1)} games simulated`);
    }
  }
  saveStats(stats, numGames);
}

simulateGames();
