const _ = require('lodash');

let strings;
if (process.env.WEBPACK) {
  // eslint-disable-next-line global-require
  strings = require('../data/strings.yaml');
} else {
  // eslint-disable-next-line global-require
  strings = require('../loaders/strings');
}
let log = console.log;
if (process.env.CLI_MODE) {
  log = () => {};
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
  }).join(' and ');
};

const getChoices = (state) => {
  if (state.game.defenseCardChoices) {
    return state.game.defenseCardChoices;
  } else if (state.game.offenseCardChoices) {
    return state.game.offenseCardChoices;
  }
  return null;
};

const describeCard = (card) => {
  const messages = [];
  const strengthMap = {
    0: '0',
    1: 'really low',
    2: 'low',
    3: 'normal',
    4: 'high',
    5: 'really high',
  };
  let startOfSentenceIndex = 0;
  const startOfSentences = [
    'This tactic',
    'It',
    'Also, it',
    'Furthermore, it',
    'Moreover, it',
    'Additionally, it',
  ];
  const startOfSentence = () => {
    const newStart = startOfSentences[startOfSentenceIndex];
    startOfSentenceIndex = (startOfSentenceIndex + 1) % startOfSentences.length;
    return newStart;
  };
  messages.push(`${card.name} is a ${strengthMap[Math.min(card.strength, 5)]} strength tactic.`);
  if (card.space) {
    messages.push(`${startOfSentence()} is deployed at one of the ships.`);
  } else if (card.planet) {
    messages.push(`${startOfSentence()} is deployed to the planet.`);
  }
  if (card.count) {
    messages.push(`We can deploy ${card.name} up to ${card.count} more times this game.`);
  } else {
    messages.push(`${card.name} can only be deployed once during the game.`);
  }
  if (card.offense && !card.defense) {
    messages.push(`${startOfSentence()} can only be used on offense.`);
  } else if (!card.offense && card.defense) {
    messages.push(`${startOfSentence()} can only be used for defense.`);
  } else if (card.offense && card.defense) {
    messages.push(`${startOfSentence()} can be used on both offense and defense.`);
  } else if (card.development) {
    messages.push(`${startOfSentence()} is a development, which can be used instead of a defensive tactic.`);
  }
  const extrasMap = {
    0: '0',
    1: 'some',
    2: 'a lot of',
    3: 'a ton of',
  };
  if (card.damageStrength) {
    messages.push(`${startOfSentence()} will do ${extrasMap[Math.min(card.damageStrength, 3)]} extra damage to the enemies it faces.`);
  }
  if (card.shieldStrength) {
    messages.push(`${startOfSentence()} has ${extrasMap[Math.min(card.shieldStrength, 3)]} shields to prevent damage every round.`);
  }
  if (card.armorStrength) {
    messages.push(`${startOfSentence()} has ${extrasMap[Math.min(card.armorStrength, 3)]} armor to help prevent damage one time.`);
  }
  if (card.recharge) {
    messages.push(`${startOfSentence()} needs ${card.recharge} rounds to recharge once deployed before it can be deployed again.`);
  }
  if (card.tank) {
    messages.push(`${startOfSentence()} will take the damage for all allies in it's battle zone.`);
  }
  if (card.shy) {
    messages.push(`${startOfSentence()} will run away to the other ship if an enemy tactic is played here.`);
  }
  if (card.tribe && !card.development) {
    messages.push(`${startOfSentence()} is part of the ${card.tribe} group and may benefit from abilities which help ${card.tribe}s.`);
  }
  if (card.description) {
    messages.push(card.description);
  }
  messages.push('<break strength="x-strong" />');
  return ['<prosody rate="90%">', ...messages, '</prosody>'];
};

const describeChoiceCards = (state) => {
  const cards = _.values(getChoices(state).playerCards);
  return cards.map(describeCard);
};

/** i.e.
 * zoneName = "our ship"
 * our = "our defending" or "our attacking"
 * their = "the enemy's defending" or the "enemy's"
 */
const zoneReport = (zone, prevZone, zoneName, our, their) => {
  let messages = [];
  const destroyedPlayerCards = _.differenceBy(
    zone.playerGraveyard, prevZone.playerGraveyard, 'cardUid');
  const destroyedAiCards = _.differenceBy(zone.aiGraveyard, prevZone.aiGraveyard, 'cardUid');
  messages.push(`In the battle at ${zoneName},`);
  let capBool = true;
  const capitalize = str => (capBool ? _.capitalize(str) : str);
  if (destroyedAiCards.length > 0 && destroyedPlayerCards.length > 0) {
    messages.push(`we destroyed ${their} ${getNamesMessage(destroyedAiCards)} but the enemy destroyed ${our} ${getNamesMessage(destroyedPlayerCards)}.`);
  } else if (destroyedAiCards.length > 0) {
    messages.push(`we destroyed ${their} ${getNamesMessage(destroyedAiCards)}.`);
  } else if (destroyedPlayerCards.length > 0) {
    messages.push(`the enemy destroyed ${our} ${getNamesMessage(destroyedPlayerCards)}.`);
  } else {
    capBool = false;
  }

  if (zone.playerCards.length > 0 && zone.aiCards.length > 0) {
    messages.push(`${capitalize('conflict')} continues between ${our} ${getNamesMessage(zone.playerCards)} and ${their} ${getNamesMessage(zone.aiCards)}.`);
  } else if (zone.playerCards.length > 0) {
    messages.push(`${capitalize(our)} ${getNamesMessage(zone.playerCards)} still survive.`);
  } else if (zone.aiCards.length > 0) {
    messages.push(`${capitalize(their)} ${getNamesMessage(zone.aiCards)} are still alive.`);
  } else if (destroyedAiCards.length === 0 && destroyedPlayerCards.length === 0) {
    messages = `${capitalize(zoneName)} has been quiet.`;
  } else {
    messages.push(`${capitalize('noone')} is left alive.`);
  }


  return messages;
};

const statusReport = (state) => {
  /* Example status report:
  We are winning at the planet and our ship. There is an ongoing conflict at the enemy's ship.
  In the battle here at our ship, we destroyed the enemy's attacking blah,
  while he destroyed our defending blah.
  Our blah still survives. In the battle at our opponent's ship, ...
  Their ship has taken serious damage and we will win if we can damage it again.
  In the battle at the planet, ... Our blah and his blah and blah remain locked in combat.
  We have currently taken hold of the planet and
  will win if they do not send forces to take it back.
  */
  const messages = [];
  const ourShipName = 'our ship';
  const theirShipName = 'the enemy\'s ship';
  const planetName = 'the planet';
  const winning = [];
  const losing = [];
  const conflict = [];
  const neutral = [];
  if (state.game.ships.playerShip.playerCards.length > 0 &&
      state.game.ships.playerShip.aiCards.length > 0) {
    conflict.push(ourShipName);
  } else if (state.game.ships.playerShip.playerCards.length > 0) {
    winning.push(ourShipName);
  } else if (state.game.ships.playerShip.aiCards.length > 0) {
    losing.push(ourShipName);
  } else {
    neutral.push(ourShipName);
  }
  if (state.game.ships.aiShip.playerCards.length > 0 &&
      state.game.ships.aiShip.aiCards.length > 0) {
    conflict.push(theirShipName);
  } else if (state.game.ships.aiShip.playerCards.length > 0) {
    winning.push(theirShipName);
  } else if (state.game.ships.aiShip.aiCards.length > 0) {
    losing.push(theirShipName);
  } else {
    neutral.push(theirShipName);
  }
  if (state.game.planet.playerCards.length > 0 && state.game.planet.aiCards.length > 0) {
    conflict.push(planetName);
  } else if (state.game.planet.playerCards.length > 0) {
    winning.push(planetName);
  } else if (state.game.planet.aiCards.length > 0) {
    losing.push(planetName);
  } else {
    neutral.push(planetName);
  }
  if (winning.length > 0) {
    messages.push(`We are winning at ${winning.join(' and ')}.`);
  }
  if (losing.length > 0) {
    messages.push(`We are losing at ${losing.join(' and ')}.`);
  }
  if (conflict.length > 0) {
    conflict.push(`There is ongoing conflict at ${neutral.join(' and ')}.`);
  }
  if (neutral.length > 0) {
    neutral.push(`There is no fighting at ${neutral.join(' and ')}.`);
  }

  // our ship report
  messages.push(zoneReport(state.game.ships.playerShip, state.game.prevState.ships.playerShip,
    ourShipName, 'our defending', 'their attacking'));
  if (state.game.ships.playerShip.shipDamage >
      state.game.prevState.ships.playerShip.shipDamage) {
    messages.push('Our ship has taken damage!');
    if (state.game.ships.playerShip.shipDamage === 1) {
      messages.push('One more hit and we are going down!');
    }
  }

  // their ship report
  messages.push(zoneReport(state.game.ships.aiShip, state.game.prevState.ships.aiShip,
    theirShipName, 'our attacking', 'their defending'));
  if (state.game.ships.aiShip.shipDamage >
      state.game.prevState.ships.aiShip.shipDamage) {
    messages.push('Our forces have damaged their ship!');
    if (state.game.ships.aiShip.shipDamage === 1) {
      messages.push('One more hit and we will win this battle!');
    }
  }

  // planet report
  messages.push(zoneReport(state.game.planet, state.game.prevState.planet,
    planetName, 'our', 'their'));
  if (!state.game.prevState.planet.playerEntrenched &&
      state.game.planet.playerEntrenched) {
    messages.push('Our forces have taken hold on the planet! If they don\'t defend, the planet is ours!');
  }
  if (!state.game.prevState.planet.aiEntrenched && state.game.planet.aiEntrenched) {
    messages.push('Their forces are overrunning the planet! If we don\'t defend, we will lose the planet entirely!');
  }
  messages.push('<break strength="x-strong" />');
  return messages;
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
        log(`AI offense is ${aiOffenseChoice.name}`);
        messages.push(`The opponent has deployed ${aiOffenseChoice.name}.`);
      }
    }
    if (Object.keys(state.game.defenseCardChoices.playerCards).length > 0) {
      messages.push('What defensive tactics would you like to deploy?');
    }
  } else {
    // combat has occurred!
    log('Player deck:');
    log(JSON.stringify(state.game.playerDeck));
    log('AI deck:');
    log(JSON.stringify(state.game.aiDeck));
    log('Player ship:');
    log(JSON.stringify(state.game.ships.playerShip));
    log('AI ship:');
    log(JSON.stringify(state.game.ships.aiShip));
    log('Planet:');
    log(JSON.stringify(state.game.planet));
    const playerDefenseChoice = _.values(state.game.prevState.defenseCardChoices.playerCards)[0];
    const aiDefenseChoice = _.values(state.game.prevState.defenseCardChoices.aiCards)[0];
    if (playerDefenseChoice) {
      messages.push(`You have deployed ${playerDefenseChoice.name} for defense.`);
      messages.push('<break strength="x-strong" />');
    }
    if (aiDefenseChoice) {
      log(`AI defense is ${aiDefenseChoice.name}`);
      messages.push(`The opponent has defended with ${aiDefenseChoice.name}. `);
      messages.push('<break strength="x-strong" />');
    }
    messages.push(statusReport(state));
  }
  return messages;
};

const pickACardHelper = cliMode => (state) => {
  const message = [];
  const cardChoices = getChoices(state);
  let num = 0;
  const choiceNames = _.map(
    _.values(cardChoices.playerCards),
    (card) => {
      if (cliMode) {
        num += 1;
        return `${num}. ${card.name}`;
      }
      return card.name;
    });
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

const pickACard = pickACardHelper(false);

const pickACardCli = pickACardHelper(true);

const unknown = state => [
  'I didn\'t get that.',
  pickACard(state),
];

const endOfGame = (state) => {
  const gameEndResults = state.game.gameEndResults;
  const message = [];
  log('game results');
  log(JSON.stringify(gameEndResults));
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
  pickACardCli,
  describeRecentState,
  unknown,
  endOfGame,
  invalidCard,
  describeChoiceCards,
  statusReport,

  // util functions
  getChoices,
};
