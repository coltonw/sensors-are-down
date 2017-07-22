const _ = require('lodash');

let strings;
if (process.env.WEBPACK) {
  // eslint-disable-next-line global-require
  strings = require('../strings/strings.yaml');
} else {
  // eslint-disable-next-line global-require
  strings = require('../loaders/strings');
}

// TODO: Add flow, which has misununderstood problems with this code

// This is totally a hack. We may want to make a "pluralName" in the YAML.
const pluralize = (word) => {
  if (word.charAt(word.length - 1) === 's') {
    return word;
  }
  return `${word}s`;
};

const getNamesMessage = (cards) => {
  const counts = _.countBy(cards, 'name');
  return Object.keys(counts).map((name) => {
    if (counts[name] === 1) {
      return name;
    }
    return `${counts[name]} ${pluralize(name)}`;
  });
};

const getChoices = (state) => {
  if (state.game.defenseCardChoices) {
    return state.game.defenseCardChoices;
  } else if (state.game.offenseCardChoices) {
    return state.game.offenseCardChoices;
  }
  return null;
};

const describeRecentState = (state) => {
  const messages = [];
  if (state.game.defenseCardChoices) {
    // still picking defense cards
    if (state.game.offenseCardChoices) {
      const playerOffenseChoice = _.values(state.game.offenseCardChoices.playerCards)[0];
      if (playerOffenseChoice) {
        messages.push(`You have deployed ${playerOffenseChoice.name}.`);
      }
      const aiOffenseChoice = _.values(state.game.offenseCardChoices.aiCards)[0];
      if (aiOffenseChoice) {
        console.log(`AI offense is ${aiOffenseChoice.name}`);
        messages.push(`The opponent has deployed ${aiOffenseChoice.name}.`);
      }
    }
    if (Object.keys(state.game.defenseCardChoices.playerCards).length > 0) {
      messages.push('What defensive tactics would you like to deploy?');
    }
  } else {
    // combat has occurred!
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
    const survived = (defenseChoice, myShip, cardsKey) => {
      if (defenseChoice.planet) {
        return state.game.planet[cardsKey];
      } else if (defenseChoice.space) {
        return state.game.ships[myShip][cardsKey];
      }
      return [];
    };
    let playerShipDescribed = false;
    let aiShipDescribed = false;
    let planetDescribed = false;
    const playerDefenseChoice = _.values(state.game.prevState.defenseCardChoices.playerCards)[0];
    const aiDefenseChoice = _.values(state.game.prevState.defenseCardChoices.aiCards)[0];
    const allPlanetDefense = playerDefenseChoice && aiDefenseChoice &&
      playerDefenseChoice.planet && aiDefenseChoice.planet;
    if (playerDefenseChoice) {
      messages.push(`You have deployed ${playerDefenseChoice.name} for defense.`);
      if (!allPlanetDefense) {
        const aiSurvivors = survived(playerDefenseChoice, 'playerShip', 'aiCards');
        if (aiSurvivors.length > 0) {
          const aiSurvivorNames = getNamesMessage(aiSurvivors);
          messages.push(`Unfortunately, ${aiSurvivorNames} have survived your defense.`);
        } else {
          messages.push('Your defense successfully destroyed all enemies.');
        }
        const playerSurvivors = survived(playerDefenseChoice, 'playerShip', 'playerCards');
        if (playerSurvivors.length > 0) {
          const playerSurvivorNames = getNamesMessage(playerSurvivors);
          messages.push(`Your ${playerSurvivorNames} have survived the defense.`);
        } else {
          messages.push('All your defenders perished.');
        }
      }
      if (playerDefenseChoice.space) {
        playerShipDescribed = true;
      } else {
        planetDescribed = true;
      }
      messages.push('<break strength="x-strong" />');
    }
    if (aiDefenseChoice) {
      console.log(`AI defense is ${aiDefenseChoice.name}`);
      messages.push(`The opponent has defended with ${aiDefenseChoice.name}. `);
      if (!allPlanetDefense) {
        const playerSurvivors = survived(aiDefenseChoice, 'aiShip', 'playerCards');
        if (playerSurvivors.length > 0) {
          const playerSurvivorNames = getNamesMessage(playerSurvivors);
          messages.push(`Fortunately, ${playerSurvivorNames} have survived the enemy's defense.`);
        } else {
          messages.push('Sadly, their defense decimated our forces.');
        }
        const aiSurvivors = survived(aiDefenseChoice, 'aiShip', 'aiCards');
        if (aiSurvivors.length > 0) {
          const aiSurvivorNames = getNamesMessage(aiSurvivors);
          messages.push(`The enemies forces of ${aiSurvivorNames} still stand after the enemy's defense.`);
        } else {
          messages.push('Their defensive forces are no more.');
        }
      }
      if (aiDefenseChoice.space) {
        aiShipDescribed = true;
      } else {
        planetDescribed = true;
      }
      messages.push('<break strength="x-strong" />');
    }
    if (allPlanetDefense || !planetDescribed) {
      if (state.game.planet.playerCards.length > 0) {
        const playerSurvivorNames = getNamesMessage(state.game.planet.playerCards);
        if (allPlanetDefense) {
          messages.push(`Fortunately, our ${playerSurvivorNames} have survived the battle on the planet.`);
        } else if (!state.game.prevState.planet.aiEntrenched && state.game.planet.aiEntrenched) {
          messages.push(`Our ${playerSurvivorNames} have taken hold on the planet! If they don't defend, the planet is ours!`);
        } else {
          messages.push(`Our ${playerSurvivorNames} are still fighting on the planet.`);
        }
      } else if (allPlanetDefense || state.game.prevState.planet.playerCards.length > 0) {
        messages.push('All our forces on the planet were destroyed.');
      }
      if (state.game.planet.aiCards.length > 0) {
        const aiSurvivorNames = getNamesMessage(state.game.planet.aiCards);
        if (allPlanetDefense) {
          messages.push(`Unfortunately, their ${aiSurvivorNames} have survived the battle on the planet.`);
        } else if (!state.game.prevState.planet.aiEntrenched && state.game.planet.aiEntrenched) {
          messages.push(`Their ${aiSurvivorNames} are overrunning the planet! If we don't defend, we will lose the planet entirely!`);
        } else {
          messages.push(`Their ${aiSurvivorNames} are still fighting on the planet.`);
        }
      } else if (allPlanetDefense || state.game.prevState.planet.aiCards.length > 0) {
        messages.push('We have destroyed all the enemies on the planet.');
      }
      // TODO: entrenched
      messages.push('<break strength="x-strong" />');
    }
    if (!playerShipDescribed) {
      if (state.game.ships.playerShip.aiCards.length > 0) {
        // Describing an idle defense is uninteresting, so we only describe them
        // if they are locked in combat with some offense
        if (state.game.ships.playerShip.playerCards.length > 0) {
          const playerSurvivorNames = getNamesMessage(state.game.ships.playerShip.playerCards);
          messages.push(`Fortunately, our ${playerSurvivorNames} have survived while defending our ship.`);
        }
        const aiSurvivorNames = getNamesMessage(state.game.ships.playerShip.aiCards);
        if (state.game.ships.playerShip.shipDamage >
            state.game.prevState.ships.playerShip.shipDamage) {
          messages.push(`Our ship has taken damage from the attacking ${aiSurvivorNames}!`);
          if (state.game.ships.playerShip.shipDamage === 1) {
            messages.push('One more hit and we are going down!');
          }
        } else {
          messages.push(`Unfortunately, their ${aiSurvivorNames} are still attacking our ship.`);
        }
      }
    }
    if (!aiShipDescribed) {
      if (state.game.ships.aiShip.playerCards.length > 0) {
        // Describing an idle defense is uninteresting, so we only describe them
        // if they are locked in combat with some offense
        if (state.game.ships.aiShip.aiCards.length > 0) {
          const aiSurvivorNames = getNamesMessage(state.game.ships.aiShip.aiCards);
          messages.push(`Unfortunately, their ${aiSurvivorNames} have survived while defending their ship.`);
        }
        const playerSurvivorNames = getNamesMessage(state.game.ships.aiShip.playerCards);
        if (state.game.ships.aiShip.shipDamage >
            state.game.prevState.ships.aiShip.shipDamage) {
          messages.push(`Our ${playerSurvivorNames} have damaged their ship!`);
          if (state.game.ships.aiShip.shipDamage === 1) {
            messages.push('One more hit and we will win this battle!');
          }
        } else {
          messages.push(`Fortunately, our ${playerSurvivorNames} are still attacking their ship.`);
        }
      }
    }
    if (state.game.offenseCardChoices) {
      if (state.game.offenseCardChoices.playerCards &&
          Object.keys(state.game.offenseCardChoices.playerCards).length > 0) {
        messages.push('Time for the next offensive.');
      } else {
        messages.push('We are out of offensive tactics but the battle rages on!');
      }
    }
  }
  return messages;
};

const pickACard = (state) => {
  const message = [];
  const cardChoices = getChoices(state);
  const choiceNames = _.map(
    _.values(cardChoices.playerCards),
    value => value.name);
  const choices = choiceNames.join(', or ');
  if (choiceNames.length === 1) {
    message.push({
      output: `We currently have readied ${choices}. Please say ${choices} to deploy them.`,
      reprompt: `Please say ${choices}.`,
    });
  } else if (choiceNames.length > 1) {
    // This 2 tactics part gets real repetitive. Consider removing or
    // varying or only showing in the first round or something.
    message.push({
      output: `We currently have readied ${choiceNames.length} tactics for you to choose between. Would you like to deploy ${choices}?`,
      reprompt: `Please say either ${choices}, or describe.`,
    });
  } // else no choices and no message so we will be playing automatically
  return message;
};

const unknown = state => [
  'I didn\'t get that.',
  pickACard(state),
];

const endOfGame = (state) => {
  const gameEndResults = state.game.gameEndResults;
  const message = [];
  console.log('game results');
  console.log(JSON.stringify(gameEndResults));
  if (gameEndResults.playerShipDefeat) {
    message.push(strings.gameEnd.shipDefeat);
  } else if (gameEndResults.playerShipVictory) {
    message.push(strings.gameEnd.shipVictory);
  } else if (gameEndResults.playerPlanetVictory) {
    message.push(strings.gameEnd.planetVictory);
  } else if (gameEndResults.playerPlanetDefeat) {
    message.push(strings.gameEnd.planetDefeat);
  } else if (gameEndResults.playerTiebreakerVictory) {
    message.push(strings.gameEnd.tiebreakerVictory);
  } else if (gameEndResults.playerTiebreakerDefeat) {
    message.push(strings.gameEnd.tiebreakerDefeat);
  } else if (gameEndResults.drawShipsDestroyed) {
    message.push(strings.gameEnd.drawShipsDestroyed);
  } else if (gameEndResults.drawStalemate) {
    message.push(strings.gameEnd.drawStalemate);
  } else {
    message.push(strings.gameEnd.unknown);
  }
  message.push('Thank you for playing! Would you like to play again?');
  return message;
};

const invalidCard = (state) => {
  const cardChoices = getChoices(state);
  const choices = _.map(
    _.values(cardChoices.playerCards),
    value => value.name);
  return {
    output: _.template(strings.invalidCard.outputTemplate)({ choices }),
    reprompt: _.template(strings.invalidCard.repromptTemplate)({ choices }),
  };
};

module.exports = {
  // speech functions
  pickACard,
  describeRecentState,
  unknown,
  endOfGame,
  invalidCard,

  // util functions
  getChoices,
};
