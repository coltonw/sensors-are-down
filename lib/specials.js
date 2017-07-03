const _ = require('lodash');

function planetaryBombers(state) {
  return _.assign({}, state, {
    planet: _.assign({}, state.planet, {
      playerCards: [],
      aiCard: [],
      playerEntrenched: false,
      aiEntrenched: false,
    }),
  });
}

const specials = {
  planetaryBombers,
};

function getCurrentChoices(state) {
  if (state.defenseCardChoices) {
    return state.defenseCardChoices;
  } else if (state.offenseCardChoices) {
    return state.offenseCardChoices;
  }
  return null;
}

function playSpecials(phase, state) {
  const choices = getCurrentChoices(state);
  // This may need to be ammended as things get more complicated
  // including adding specials data to the state and such
  if (choices) {
    const playerSpecialIds = Object.keys(choices.playerCards).filter(
      cardId => choices.playerCards[cardId].special === phase);
    const playerSpecials = _.flatMap(playerSpecialIds,
        cardId => (specials[cardId] ? [specials[cardId]] : []));
    const aiSpecialIds = Object.keys(choices.aiCards).filter(
      cardId => choices.aiCards[cardId].special === phase);
    const aiSpecials = _.flatMap(aiSpecialIds,
        cardId => (specials[cardId] ? [specials[cardId]] : []));
    return _.flow(playerSpecials, aiSpecials)(state);
  }
  return state;
}

module.exports = {
  playSpecials,
};
