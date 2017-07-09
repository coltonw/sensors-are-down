const Alexa = require('alexa-sdk');
const config = require('config');
const _ = require('lodash');
const engine = require('./lib/engine');

const states = {
  GUESSMODE: '_GUESSMODE', // User is trying to guess the number.
  STARTMODE: '_STARTMODE', // Prompt the user to start or restart the game.
};

const newSessionHandlers = {
  NewSession() {
    if (Object.keys(this.attributes).length === 0) {
      this.attributes.gamesPlayed = 0;
      this.attributes.gameState = null;
    }
    this.handler.state = states.STARTMODE;
    this.emit(':ask', 'Welcome to sensors are down, a space combat game. ' +
            '<audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />' +
            'Would you like to play?',
            'Say yes to start the game, no to quit, or how to play to learn how to play.');
  },
  'AMAZON.StopIntent': function StopIntent() {
    this.emit(':tell', 'Goodbye!');
  },
  'AMAZON.CancelIntent': function CancelIntent() {
    this.emit(':tell', 'Goodbye!');
  },
  SessionEndedRequest() {
    console.log('session ended!');
    this.emit(':tell', 'Goodbye!');
  },
};

const startGameHandlers = Alexa.CreateStateHandler(states.STARTMODE, {
  NewSession() {
    this.emit('NewSession'); // Uses the handler in newSessionHandlers
  },
  'AMAZON.HelpIntent': function HelpIntent() {
    this.emit('HowToPlayIntent');
  },
  'AMAZON.YesIntent': function YesIntent() {
    this.attributes.guessNumber = Math.floor(Math.random() * 100);
    this.handler.state = states.GUESSMODE;
    const store = engine.init(this.attributes.gameState);
    store.dispatch(engine.startGame());
    this.attributes.gameState = store.getState();
    console.log('Player deck:');
    console.log(JSON.stringify(store.getState().game.playerDeck));
    this.emit('PickACard', '', store.getState().game.offenseCardChoices);
  },
  'AMAZON.NoIntent': function NoIntent() {
    console.log('NOINTENT');
    this.emit(':tell', 'Ok, see you next time!');
  },
  HowToPlayIntent() {
    const message = 'The goal of the game is to destroy your opponent\'s ship with 2 undefended attacks or to take over the planet with two undefended attacks. <break strength="strong" /> There are 3 combat zones: your ship, the opponent\'s ship, and the planet you ' +
      'are both fighting over. Every round you will get a choice between two offensive tactics. These tactics will ' +
      'attack either the planet or <emphasis level="strong">the opponent\'s</emphasis> ship. You can get a description of the tactics by saying describe. You will be told what your opponent picked for their offensive tactic to attack the planet or <emphasis level="strong">your</emphasis> ship. Then you will get a choice between two defensive tactics which respond either to the opponent\'s offense or to ongoing combat on the planet or your ship. Once all these choices have been made, all deployed tactics as well as tactics which survived previous rounds attack each other. You win if you have 2 undefended attacks on either the opponent\'s ship or the planet. <break strength="x-strong" /> Do you want to play?';
    this.emit(':ask', message, 'Do you want to play?');
  },
  'AMAZON.StopIntent': function StopIntent() {
    console.log('STOPINTENT');
    this.emit(':tell', 'Goodbye!');
  },
  'AMAZON.CancelIntent': function CancelIntent() {
    console.log('CANCELINTENT');
    this.emit(':tell', 'Goodbye!');
  },
  SessionEndedRequest() {
    console.log('SESSIONENDEDREQUEST');
    this.emit(':tell', 'Goodbye!');
  },
  Unhandled() {
    console.log('UNHANDLED');
    const message = 'Say yes to continue, or no to end the game.';
    this.emit(':ask', message, message);
  },
});

const getChoices = (state) => {
  if (state.game.defenseCardChoices) {
    return state.game.defenseCardChoices;
  } else if (state.game.offenseCardChoices) {
    return state.game.offenseCardChoices;
  }
  return null;
};

const guessModeHandlers = Alexa.CreateStateHandler(states.GUESSMODE, {
  NewSession() {
    this.handler.state = '';
    this.emitWithState('NewSession'); // Equivalent to the Start Mode NewSession handler
  },
  NumberGuessIntent() {
    const guessNum = parseInt(this.event.request.intent.slots.number.value, 10);
    const targetNum = this.attributes.guessNumber;
    console.log(`user guessed: ${guessNum}`);

    if (guessNum > targetNum) {
      this.emit('TooHigh', guessNum);
    } else if (guessNum < targetNum) {
      this.emit('TooLow', guessNum);
    } else if (guessNum === targetNum) {
      // With a callback, use the arrow function to preserve the correct 'this' context
      this.emit('JustRight', () => {
        this.emit(':ask', `${guessNum.toString()} is correct! Would you like to play a new game?`,
                'Say yes to start a new game, or no to end the game.');
      });
    } else {
      this.emit('NotANum');
    }
  },
  // TODO: add intent for choosing not to defend
  CardSelectIntent() {
    const cardSelected = this.event.request.intent.slots.card.value.toLowerCase();
    const store = engine.init(this.attributes.gameState);
    const choices = getChoices(store.getState());
    const match = _.find(Object.keys(choices.playerCards), cardId => (
      choices.playerCards[cardId].name.toLowerCase() === cardSelected
    ));
    console.log(`Card picked: ${match}`);
    if (match && choices) {
      if (store.getState().game.defenseCardChoices) {
        store.dispatch(engine.pickDefenseCard(match));
      } else {
        store.dispatch(engine.pickOffenseCard(match));
      }
      this.attributes.gameState = store.getState();
      this.emit('DescribeRecentState', '', store.getState());
    } else if (choices && Object.keys(choices.playerCards).length > 0) {
      this.emit('NotAValidCard', choices);
    } else {
      // TODO: real error handling
      this.emit('NotANum');
    }
  },
  DescribeIntent() {
    console.log('Describe intent');
    const store = engine.init(this.attributes.gameState);
    const cardChoices = getChoices(store.getState());
    let messageSoFar = '';
    // TODO: also describe the opponent's offensive choice when defending
    const choiceDescs = _.map(
      _.values(cardChoices.playerCards),
      value => value.description);
    messageSoFar += [...choiceDescs, ''].join(' <break strength="x-strong" /> ');

    this.emit('PickACard', messageSoFar, cardChoices);
  },
  // TODO: add yes intent for when there is only one choice to deploy
  'AMAZON.HelpIntent': function HelpIntent() {
    this.emit(':ask', 'I am thinking of a number between zero and one hundred, try to guess and I will tell you' +
            ' if it is higher or lower.', 'Try saying a number.');
  },
  'AMAZON.StopIntent': function StopIntent() {
    console.log('STOPINTENT');
    this.emit(':tell', 'Goodbye!');
  },
  'AMAZON.CancelIntent': function CancelIntent() {
    console.log('CANCELINTENT');
  },
  SessionEndedRequest() {
    console.log('SESSIONENDEDREQUEST');
    this.attributes.endedSessionCount += 1;
    this.emit(':tell', 'Goodbye!');
  },
  Unhandled() {
    console.log('UNHANDLED');
    this.emit(':ask', 'Sorry, I didn\'t get that. Try saying a number.', 'Try saying a number.');
  },
});

// These handlers are not bound to a state
const guessAttemptHandlers = {
  DescribeRecentState(messageSoFarArg, state) {
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
    const newChoices = getChoices(state);
    let messageSoFar = messageSoFarArg;
    if (state.game.defenseCardChoices) {
      const playerOffenseChoice = _.values(state.game.offenseCardChoices.playerCards)[0];
      if (playerOffenseChoice) {
        messageSoFar += `You have deployed ${playerOffenseChoice.name}. `;
      }
      const aiOffenseChoice = _.values(state.game.offenseCardChoices.aiCards)[0];
      if (aiOffenseChoice) {
        messageSoFar += `The opponent has deployed ${aiOffenseChoice.name}. `;
      }
      if (Object.keys(state.game.defenseCardChoices.playerCards).length > 0) {
        messageSoFar += 'What defensive tactics would you like to deploy? ';
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
      const playerDefenseChoice = _.values(state.game.prevDefenseCardChoices.playerCards)[0];
      const aiDefenseChoice = _.values(state.game.prevDefenseCardChoices.aiCards)[0];
      const allPlanetDefense = playerDefenseChoice && aiDefenseChoice &&
        playerDefenseChoice.planet && aiDefenseChoice.planet;
      if (playerDefenseChoice) {
        messageSoFar += `You have deployed ${playerDefenseChoice.name} for defense. `;
        if (!allPlanetDefense) {
          const aiSurvivors = survived(playerDefenseChoice, 'playerShip', 'aiCards');
          if (aiSurvivors.length > 0) {
            const aiSurvivorNames = aiSurvivors.map(card => card.name).join(' and ');
            messageSoFar += `Unfortunately, ${aiSurvivorNames} have survived your defense. `;
          } else {
            messageSoFar += 'Your defense successfully destroyed all enemies. ';
          }
          const playerSurvivors = survived(playerDefenseChoice, 'playerShip', 'playerCards');
          if (playerSurvivors.length > 0) {
            const playerSurvivorNames = playerSurvivors.map(card => card.name).join(' and ');
            messageSoFar += `Your ${playerSurvivorNames} have survived the defense. `;
          } else {
            messageSoFar += 'All your defenders perished. ';
          }
        }
        messageSoFar += ' <break strength="x-strong" /> ';
      }
      if (aiDefenseChoice) {
        messageSoFar += `The opponent has defended with ${aiDefenseChoice.name}. `;
        if (!allPlanetDefense) {
          const playerSurvivors = survived(aiDefenseChoice, 'aiShip', 'playerCards');
          if (playerSurvivors.length > 0) {
            const playerSurvivorNames = playerSurvivors.map(card => card.name).join(' and ');
            messageSoFar += `Fortunately, ${playerSurvivorNames} have survived the enemy's defense. `;
          } else {
            messageSoFar += 'Sadly, their defense decimated our forces. ';
          }
          const aiSurvivors = survived(aiDefenseChoice, 'aiShip', 'aiCards');
          if (aiSurvivors.length > 0) {
            const aiSurvivorNames = aiSurvivors.map(card => card.name).join(' and ');
            messageSoFar += `The enemies forces of ${aiSurvivorNames} still stand after the enemy's defense. `;
          } else {
            messageSoFar += 'Their defensive forces are no more. ';
          }
        }
        messageSoFar += ' <break strength="x-strong" /> ';
      }
      if (allPlanetDefense) {
        if (state.game.planet.playerCards.length > 0) {
          const playerSurvivorNames = state.game.planet.playerCards.map(card => card.name).join(' and ');
          messageSoFar += `Fortunately, ${playerSurvivorNames} have survived the battle on the planet. `;
        }
        if (state.game.planet.aiCards.length > 0) {
          const aiSurvivorNames = state.game.planet.aiCards.map(card => card.name).join(' and ');
          messageSoFar += `Unfortunately, ${aiSurvivorNames} have survived the battle on the planet. `;
        }
        messageSoFar += ' <break strength="x-strong" /> ';
      }
      if (state.game.offenseCardChoices) {
        messageSoFar += 'Time for the next offensive. ';
      }
    }
    if (newChoices) {
      this.emit('PickACard', messageSoFar, newChoices);
    } else if (state.game.gameEndResults) {
      this.emit('EndOfGame', messageSoFar, state.game.gameEndResults);
    }
  },
  PlayAutomatically(messageSoFar) {
    console.log('Playing automatically');
    const store = engine.init(this.attributes.gameState);
    store.dispatch(engine.continueWithoutSelection());
    this.attributes.gameState = store.getState();
    // This can easilly lead to an infinite loop if we are in a degenerate state
    // TODO: Better handle possible infinite loops
    this.emit('DescribeRecentState', messageSoFar, store.getState());
  },
  PickACard(messageSoFar, cardChoices) {
    console.log('Pick a card intent');
    const choiceNames = _.map(
      _.values(cardChoices.playerCards),
      value => value.name);
    const choices = choiceNames.join(', or ');
    let pickCardMsg;
    let pickCardReprompt;
    if (choiceNames.length === 1) {
      pickCardMsg = `We currently have readied ${choices}. Please say ${choices} to deploy them.`;
      pickCardReprompt = `Please say ${choices}.`;
      this.emit(':ask', `${messageSoFar} ${pickCardMsg}`, pickCardReprompt);
    } else if (choiceNames.length > 1) {
      pickCardMsg = `We currently have readied ${choiceNames.length} tactics for you to choose between. Would you like to deploy ${choices}?`;
      pickCardReprompt = `Pick either ${choices}.`;
      this.emit(':ask', `${messageSoFar} ${pickCardMsg}`, pickCardReprompt);
    } else {
      this.emit('PlayAutomatically', messageSoFar);
    }
  },
  EndOfGame(messageSoFar, gameEndResults) {
    console.log('End of game intent');
    console.log(JSON.stringify(gameEndResults));
    this.handler.state = states.STARTMODE;
    this.attributes.gamesPlayed += 1;
    const playAgainMsg = 'Thank you for playing! Would you like to play again?';
    let gameResultMsg = 'Unexpected game result.';
    console.log('game results');
    console.log(JSON.stringify(gameEndResults));
    if (gameEndResults.playerShipDefeat) {
      gameResultMsg = `<say-as interpret-as="interjection">Great scott!</say-as> The ship has been irreversably damaged! We are going down!
          <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />`;
    } else if (gameEndResults.playerShipVictory) {
      gameResultMsg = 'Good job! We have detroyed the enemy ship!';
    } else if (gameEndResults.playerPlanetVictory) {
      gameResultMsg = 'Victory is ours! We have taken control of the planet!';
    } else if (gameEndResults.playerPlanetDefeat) {
      gameResultMsg = 'We have lost the planet to the enemy. We must retreat before they set up planet to orbit missile barrage!';
    } else if (gameEndResults.playerTiebreakerVictory) {
      gameResultMsg = `The ship is going down but it looks like we took them out too and have taken the planet. Our sacrifice will not be in vain!
          <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />`;
    } else if (gameEndResults.playerTiebreakerDefeat) {
      gameResultMsg = `Both ours and the enemy's ship is going down, but it looks like they are taking the planet. <say-as interpret-as="interjection">Phooey!</say-as>
          <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />`;
    } else if (gameEndResults.drawShipsDestroyed) {
      gameResultMsg = `Looks like no one gets the planet today, both ours and the enemy's ship are going down!
          <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />`;
    } else if (gameEndResults.drawStalemate) {
      gameResultMsg = 'Huh, looks like we both ran out of steam. Today may be a draw but we will be back to take this planet!';
    }
    console.log(`${messageSoFar} ${gameResultMsg} ${playAgainMsg}`);
    this.emit(':ask', `${messageSoFar} ${gameResultMsg} ${playAgainMsg}`);
  },
  NotAValidCard(cardChoices) {
    const choiceNames = _.map(
      _.values(cardChoices.playerCards),
      value => value.name);
    const choices = choiceNames.join(' or saying deploy ');
    this.emit(':ask', `Sorry, I didn't get that. Try saying deploy ${choices}.`, `Try saying deploy ${choices}.`);
  },
  TooHigh(val) {
    this.emit(':ask', `${val.toString()} is too high.`, 'Try saying a smaller number.');
  },
  TooLow(val) {
    this.emit(':ask', `${val.toString()} is too low.`, 'Try saying a larger number.');
  },
  JustRight(callback) {
    this.handler.state = states.STARTMODE;
    this.attributes.gamesPlayed += 1;
    callback();
  },
  NotANum() {
    this.emit(':ask', 'Sorry, I didn\'t get that. Try saying a number.', 'Try saying a number.');
  },
};

// eslint-disable-next-line no-unused-vars
exports.handler = function handler(event, context, callback) {
  const alexa = Alexa.handler(event, context);
  alexa.appId = config.deployment.appId;
  alexa.dynamoDBTableName = config.db.tableName;
  alexa.registerHandlers(newSessionHandlers,
    guessModeHandlers,
    startGameHandlers,
    guessAttemptHandlers);
  alexa.execute();
};
