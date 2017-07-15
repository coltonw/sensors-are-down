const _ = require('lodash');
// const strings = require('./strings/strings.yaml');

// TODO: Add flow, which has misununderstood problems with this code

const describeRecentState = (state) => {
  console.log('Player deck:');
  console.log(JSON.stringify(state.game.playerDeck));
  console.log('AI deck:');
  console.log(JSON.stringify(state.game.aiDeck));
  console.log('Player ship:');
  console.log(JSON.stringify(state.game.ships.playerShip));
  console.log('AI ship:');
  console.log(JSON.stringify(state.game.ships.aiShip));
  console.log('Planet:');
  console.log(JSON.stringify(state.game.planet));
  const messages = [];
  if (state.game.defenseCardChoices) {
    if (state.game.offenseCardChoices) {
      const playerOffenseChoice = _.values(state.game.offenseCardChoices.playerCards)[0];
      if (playerOffenseChoice) {
        messages.push(`You have deployed ${playerOffenseChoice.name}.`);
      }
      const aiOffenseChoice = _.values(state.game.offenseCardChoices.aiCards)[0];
      if (aiOffenseChoice) {
        messages.push(`The opponent has deployed ${aiOffenseChoice.name}.`);
      }
    }
    if (Object.keys(state.game.defenseCardChoices.playerCards).length > 0) {
      messages.push('What defensive tactics would you like to deploy?');
    }
  } else {
    const survived = (defenseChoice, myShip, cardsKey) => {
      if (defenseChoice.planet) {
        return state.game.planet[cardsKey];
      } else if (defenseChoice.space) {
        return state.game.ships[myShip][cardsKey];
      }
      return [];
    };
    const playerDefenseChoice = _.values(state.game.prevState.defenseCardChoices.playerCards)[0];
    const aiDefenseChoice = _.values(state.game.prevState.defenseCardChoices.aiCards)[0];
    const allPlanetDefense = playerDefenseChoice && aiDefenseChoice &&
      playerDefenseChoice.planet && aiDefenseChoice.planet;
    if (playerDefenseChoice) {
      messages.push(`You have deployed ${playerDefenseChoice.name} for defense.`);
      if (!allPlanetDefense) {
        const aiSurvivors = survived(playerDefenseChoice, 'playerShip', 'aiCards');
        if (aiSurvivors.length > 0) {
          const aiSurvivorNames = aiSurvivors.map(card => card.name).join(' and ');
          messages.push(`Unfortunately, ${aiSurvivorNames} have survived your defense.`);
        } else {
          messages.push('Your defense successfully destroyed all enemies.');
        }
        const playerSurvivors = survived(playerDefenseChoice, 'playerShip', 'playerCards');
        if (playerSurvivors.length > 0) {
          const playerSurvivorNames = playerSurvivors.map(card => card.name).join(' and ');
          messages.push(`Your ${playerSurvivorNames} have survived the defense.`);
        } else {
          messages.push('All your defenders perished.');
        }
      }
      messages.push('<break strength="x-strong" />');
    }
    if (aiDefenseChoice) {
      messages.push(`The opponent has defended with ${aiDefenseChoice.name}. `);
      if (!allPlanetDefense) {
        const playerSurvivors = survived(aiDefenseChoice, 'aiShip', 'playerCards');
        if (playerSurvivors.length > 0) {
          const playerSurvivorNames = playerSurvivors.map(card => card.name).join(' and ');
          messages.push(`Fortunately, ${playerSurvivorNames} have survived the enemy's defense.`);
        } else {
          messages.push('Sadly, their defense decimated our forces.');
        }
        const aiSurvivors = survived(aiDefenseChoice, 'aiShip', 'aiCards');
        if (aiSurvivors.length > 0) {
          const aiSurvivorNames = aiSurvivors.map(card => card.name).join(' and ');
          messages.push(`The enemies forces of ${aiSurvivorNames} still stand after the enemy's defense.`);
        } else {
          messages.push('Their defensive forces are no more.');
        }
      }
      messages.push('<break strength="x-strong" />');
    }
    if (allPlanetDefense) {
      if (state.game.planet.playerCards.length > 0) {
        const playerSurvivorNames = state.game.planet.playerCards.map(card => card.name).join(' and ');
        messages.push(`Fortunately, ${playerSurvivorNames} have survived the battle on the planet.`);
      }
      if (state.game.planet.aiCards.length > 0) {
        const aiSurvivorNames = state.game.planet.aiCards.map(card => card.name).join(' and ');
        messages.push(`Unfortunately, ${aiSurvivorNames} have survived the battle on the planet.`);
      }
      messages.push('<break strength="x-strong" />');
    }
    if (state.game.offenseCardChoices) {
      messages.push('Time for the next offensive.');
    }
  }
  return messages;
};

module.exports = {
  describeRecentState,
};
