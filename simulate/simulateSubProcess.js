require('babel-register');
const _ = require('lodash');
const argv = require('yargs').boolean('ai').boolean('verbose').argv;
const allCards = require('../loaders/cards');
const engine = require('../lib/engine');

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
      if (cardIds[i] !== 'deadCard' && cardIds[j] !== 'deadCard') {
        cardComboIds.push(`${cardIds[i]}-${cardIds[j]}`);
      }
    }
  }
  const aiCardIds = Object.keys(startState.game.aiDeck).sort();
  for (let i = 0; i < cardIds.length; i += 1) {
    for (let j = 0; j < aiCardIds.length; j += 1) {
      if (cardIds[i] !== 'deadCard' && cardIds[j] !== 'deadCard') {
        matchupIds.push(`${cardIds[i]}-vs-${aiCardIds[j]}`);
      }
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

function simulateGames() {
  const numGames = parseInt(argv._[0], 10) || 200;
  const includeArr = _.isArray(argv.include || []) ? argv.include || [] : [argv.include];
  const includeCards = _.intersection(includeArr, Object.keys(allCards));

  let stats = {
    total: {},
    cards: {},
    cardCombos: {},
    matchups: {},
  };
  // We add in a dead card which does nothing to help detect
  // if a card actually has a net negative effect on win percentage
  const allCardsPlusDead = _.assign({},
    allCards,
    {
      deadCard: { name: 'Dead Card' },
    });
  for (let i = 0; i < numGames; i += 1) {
    const store = engine.init();
    store.dispatch(engine.startGame(includeCards, allCardsPlusDead));
    const startState = store.getState();
    runSingleGame(store, argv.ai, argv.verbose);
    const endState = store.getState();
    stats = recordStats(startState, endState, stats);
    if ((i + 1) % 100 === 0) {
      process.send(i + 1);
    }
  }
  process.send(stats);
}

simulateGames();
