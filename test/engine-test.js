const assert = require('assert');
const _ = require('lodash');
const engine = require('../lib/engine');
const { combatHelper } = require('../lib/reducers');

describe('engine', () => {
  it('should initialize properly', () => {
    const store = engine.init(null);
    store.dispatch(engine.startGame());
    const choiceNames = _.map(
      _.values(store.getState().game.offenseCardChoices.playerCards), value => value.name);
    assert.equal(choiceNames.length, 2, 'there are two choices');
    const allOffense = _.every(_.values(store.getState().game.offenseCardChoices.playerCards),
      card => card.offense);
    assert(allOffense, 'all the offensive choices are offense');
  });

  it('should run combat in one zone properly', () => {
    const noCardsPreCombat = {
      playerCards: [],
      aiCards: [],
      playerGraveyard: [],
      aiGraveyard: [],
      keepYour: 'mangy hands off me',
    };
    const noCardsResult = combatHelper(noCardsPreCombat, {});
    assert.deepEqual(noCardsResult, noCardsPreCombat, 'no cards to still no cards');

    const oneSideCardsPreCombat = {
      playerCards: [{ cardUid: '1', strength: 2, defense: 1 }, { cardUid: '2', strength: 1 }],
      aiCards: [],
      playerGraveyard: [],
      aiGraveyard: [],
      pleaseDont: 'touch this',
    };
    const oneSideCardsResult = combatHelper(oneSideCardsPreCombat, {});
    assert.deepEqual(oneSideCardsResult, oneSideCardsPreCombat, 'one card to still one card');

    const zeroStrength = cards => cards.map(card => _.assign({}, card, { strength: 0 }));
    const evenStrengthPreCombat = {
      playerCards: [{ cardUid: '1', strength: 2 }, { cardUid: '2', strength: 1 }],
      aiCards: [{ cardUid: '3', strength: 3 }],
      playerGraveyard: [],
      aiGraveyard: [],
    };
    const evenStrengthResult = combatHelper(evenStrengthPreCombat, {});
    assert.deepEqual(evenStrengthResult,
      {
        playerCards: [],
        aiCards: [],
        playerGraveyard: zeroStrength(evenStrengthPreCombat.playerCards),
        aiGraveyard: zeroStrength(evenStrengthPreCombat.aiCards),
      }, 'even strength everything dies');

    const defenseBonusWorksResult = combatHelper({
      playerCards: [{ cardUid: '1', strength: 4, someIgnored: 'stuff' }],
      aiCards: [{ cardUid: '2', strength: 3 }],
      playerGraveyard: [],
      aiGraveyard: [],
    }, {});
    assert.deepEqual(defenseBonusWorksResult, {
      playerCards: [{ cardUid: '1', strength: 2, someIgnored: 'stuff' }],
      aiCards: [],
      playerGraveyard: [],
      aiGraveyard: [{ cardUid: '2', strength: 0 }],
    }, 'defense bonus works as expected');

    const offenseWorksResult = combatHelper({
      playerCards: [{ cardUid: '1', strength: 4, someIgnored: 'stuff' }],
      aiCards: [{ cardUid: '2', strength: 3, damageStrength: 2 }],
      playerGraveyard: [],
      aiGraveyard: [],
    }, {});
    assert.deepEqual(offenseWorksResult, {
      playerCards: [],
      aiCards: [],
      playerGraveyard: [{ cardUid: '1', strength: 0, someIgnored: 'stuff' }],
      aiGraveyard: [{ cardUid: '2', strength: 0, damageStrength: 2 }],
    }, 'offense on cards works properly');

    const defenseWorksResult = combatHelper({
      playerCards: [{ cardUid: '1', strength: 4, someIgnored: 'stuff' }],
      aiCards: [{ cardUid: '2', strength: 3, shieldStrength: 2 }],
      playerGraveyard: [],
      aiGraveyard: [],
    }, {});
    assert.deepEqual(defenseWorksResult, {
      playerCards: [{ cardUid: '1', strength: 2, someIgnored: 'stuff' }],
      aiCards: [{ cardUid: '2', strength: 1, shieldStrength: 2 }],
      playerGraveyard: [],
      aiGraveyard: [],
    }, 'defense on cards works properly');

    const deleteAFewPreCombat = {
      playerCards: [
        { cardUid: '1', strength: 2 },
        { cardUid: '2', strength: 1 },
        { cardUid: '3', strength: 2 }],
      aiCards: [{ cardUid: '4', strength: 3 }, { cardUid: '5', strength: 4 }],
      playerGraveyard: [{ cardUid: 'alreadyDead', strength: 0 }],
      aiGraveyard: [],
    };
    const deleteAFewResult = combatHelper(deleteAFewPreCombat, {});
    assert.deepEqual(deleteAFewResult, {
      playerCards: [],
      aiCards: [{ cardUid: '5', strength: 3 }],
      playerGraveyard: [
        { cardUid: 'alreadyDead', strength: 0 },
        { cardUid: '1', strength: 0 },
        { cardUid: '2', strength: 0 },
        { cardUid: '3', strength: 0 }],
      aiGraveyard: [{ cardUid: '4', strength: 0 }],
    }, 'delete a bunch');
  });

  it('should properly play your first card', () => {
    const store = engine.init(null);
    store.dispatch(engine.startGame());
    const firstCardId = Object.keys(store.getState().game.offenseCardChoices.playerCards)[0];
    const firstCard = store.getState().game.offenseCardChoices.playerCards[firstCardId];
    assert.equal(Object.keys(store.getState().game.offenseCardChoices.playerCards).length, 2, 'two choices are presented');
    store.dispatch(engine.pickOffenseCard(firstCardId));
    assert(store.getState().game.offenseCardChoices.playerCards[firstCardId], 'the selected card is still in the choices');
    assert.equal(Object.keys(store.getState().game.offenseCardChoices.playerCards).length, 1, 'the selected card is the only one left');
    const allPlayerCardsInPlay = [
      ...store.getState().game.planet.playerCards,
      ...store.getState().game.ships.playerShip.playerCards,
      ...store.getState().game.ships.aiShip.playerCards];
    assert.equal(allPlayerCardsInPlay.length, 1, 'there should be only one player card in play');
    assert.deepEqual(
      [{ ...allPlayerCardsInPlay[0], cardUid: null }],
      [_.assign({}, firstCard, { cardId: firstCardId, cardUid: null })],
      'the card played should be in play');

    const firstCardRemainingCount = store.getState().game.playerDeck[firstCardId] ?
        store.getState().game.playerDeck[firstCardId].count : 0;
    const firstCardOriginalCount = typeof firstCard.count === 'number' ? firstCard.count : 1;
    assert.equal(firstCardRemainingCount, firstCardOriginalCount - 1, 'card played should have been removed from the player deck');
  });

  it('should properly present defense choices', () => {
    const store = engine.init(null);
    store.dispatch(engine.startGame());
    const planetDefenseCount = _.filter(
      _.values(store.getState().game.playerDeck),
      card => card.defense && card.planet).length;
    const shipDefenseCount = _.filter(
      _.values(store.getState().game.playerDeck),
      card => card.defense && card.space).length;
    const firstCardId = Object.keys(store.getState().game.offenseCardChoices.playerCards)[0];
    store.dispatch(engine.pickOffenseCard(firstCardId));
    // it is possible there are only 1 or even 0 cards in the deck that can defend against
    // the card the opponent played. In that case, less than 2 cards will be presented
    const applicableDefenseCardsCount =
      _.values(store.getState().game.offenseCardChoices.aiCards)[0].space ?
        shipDefenseCount : planetDefenseCount;
    assert.equal(Object.keys(store.getState().game.defenseCardChoices.playerCards).length, Math.min(2, applicableDefenseCardsCount), 'two choices are presented');
  });

  it('should properly remove cards from opponent deck', () => {
    const store = engine.init(null);
    store.dispatch(engine.startGame());
    const getTotalCardCount = deck => Object.keys(deck).reduce(
      (count, cardId) => count + (deck[cardId].count || 1), 0);
    const opponentCardCount = getTotalCardCount(store.getState().game.aiDeck);
    store.dispatch(
      engine.pickOffenseCard(Object.keys(store.getState().game.offenseCardChoices.playerCards)[0]));
    const opponentNewCardCount = getTotalCardCount(store.getState().game.aiDeck);
    assert.equal(opponentNewCardCount, opponentCardCount - 1, 'opponent card gets removed');
    store.dispatch(
      engine.pickDefenseCard(Object.keys(store.getState().game.defenseCardChoices.playerCards)[0]));
    const opponentCardCountAfterDefense = getTotalCardCount(store.getState().game.aiDeck);
    // This test may randomly fail in the very rare case the opponent
    // has no defense choices against your offense choice
    assert.equal(opponentCardCountAfterDefense, opponentCardCount - 2, 'opponent card gets removed after defense');
  });

  it('should resolve combat when it is meant to resolve', () => {
    const initStore = engine.init(null);
    const store = engine.init(_.assign({}, initStore.getState(), {
      game: _.assign({}, initStore.getState().game, {
        offenseCardChoices: {
          playerCards: {},
          aiCards: {},
        },
        defenseCardChoices: {
          playerCards: {},
          aiCards: {},
        },
        playerDeck: {},
        aiDeck: {},

        planet: _.assign({}, initStore.getState().game.planet, {
          playerCards: [],
          aiCards: [{ strength: 1 }],
        }),
      }),
    }));

    store.dispatch(engine.continueWithoutSelection());
    assert(store.getState().game.planet.aiEntrenched, 'opponent is now entrenched');
    store.dispatch(engine.continueWithoutSelection());
    store.dispatch(engine.continueWithoutSelection());
    assert.strictEqual(store.getState().game.offenseCardChoices, null, 'game is over, no more o card choices');
    assert.strictEqual(store.getState().game.defenseCardChoices, null, 'game is over, no more d card choices');
    assert(store.getState().game.gameEndResults.playerPlanetDefeat, 'opponent has now won');
  });

  it('should resolve in stalemate at the right time', () => {
    const initStore = engine.init(null);
    const store = engine.init(_.assign({}, initStore.getState(), {
      game: _.assign({}, initStore.getState().game, {
        offenseCardChoices: {
          playerCards: {},
          aiCards: {},
        },
        defenseCardChoices: {
          playerCards: {},
          aiCards: {},
        },
        playerDeck: {},
        aiDeck: {},

        planet: _.assign({}, initStore.getState().game.planet, {
          playerCards: [],
          aiCards: [],
        }),
      }),
    }));

    store.dispatch(engine.continueWithoutSelection());
    assert.strictEqual(store.getState().game.offenseCardChoices, null, 'game is over, no more o card choices');
    assert.strictEqual(store.getState().game.defenseCardChoices, null, 'game is over, no more d card choices');
    assert(store.getState().game.gameEndResults.drawStalemate, 'stalemate');
  });

  it('should resolve in stalemate when there are still ship defense cards', () => {
    const initStore = engine.init(null);
    const store = engine.init(_.assign({}, initStore.getState(), {
      game: _.assign({}, initStore.getState().game, {
        offenseCardChoices: {
          playerCards: {},
          aiCards: {},
        },
        defenseCardChoices: {
          playerCards: {},
          aiCards: {},
        },
        playerDeck: {},
        aiDeck: {},

        planet: _.assign({}, initStore.getState().game.planet, {
          playerCards: [],
          aiCards: [],
        }),
      }),
    }));

    store.dispatch(engine.continueWithoutSelection());
    assert.strictEqual(store.getState().game.offenseCardChoices, null, 'game is over, no more o card choices');
    assert.strictEqual(store.getState().game.defenseCardChoices, null, 'game is over, no more d card choices');
    assert(store.getState().game.gameEndResults.drawStalemate, 'stalemate');
  });
});
