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
            `You have played ${this.attributes.gamesPlayed.toString()} times. would you like to play?`,
            'Say yes to start the game or no to quit.');
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
    const message = 'I will think of a number between zero and one hundred, try to guess and I will tell you if it' +
            ' is higher or lower. Do you want to start the game?';
    this.emit(':ask', message, message);
  },
  'AMAZON.YesIntent': function YesIntent() {
    this.attributes.guessNumber = Math.floor(Math.random() * 100);
    this.handler.state = states.GUESSMODE;
    const store = engine.init(this.attributes.gameState);
    store.dispatch(engine.startGame());
    this.attributes.gameState = store.getState();
    console.log('Player deck:');
    console.dir(store.getState().game.playerDeck);
    this.emit('PickACard', store.getState().game.offenseCardChoices);
  },
  'AMAZON.NoIntent': function NoIntent() {
    console.log('NOINTENT');
    this.emit(':tell', 'Ok, see you next time!');
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
  CardSelectIntent() {
    const cardSelected = this.event.request.intent.slots.card.value.toLowerCase();
    const store = engine.init(this.attributes.gameState);
    const getChoices = (state) => {
      if (state.game.defenseCardChoices) {
        return state.game.defenseCardChoices.playerCards;
      } else if (state.game.offenseCardChoices) {
        return state.game.offenseCardChoices.playerCards;
      }
      return null;
    };
    const choices = getChoices(store.getState());
    const match = _.find(Object.keys(choices), cardId => (
      choices[cardId].name.toLowerCase() === cardSelected
    ));
    console.log(`Card picked: ${match}`);
    if (match && choices) {
      if (store.getState().game.defenseCardChoices) {
        store.dispatch(engine.pickDefenseCard(match));
      } else {
        store.dispatch(engine.pickOffenseCard(match));
      }
      this.attributes.gameState = store.getState();
      console.log('Player ship:');
      console.dir(store.getState().game.ships.playerShip);
      console.log('AI ship:');
      console.dir(store.getState().game.ships.aiShip);
      console.log('Planet:');
      console.dir(store.getState().game.planet);
      const newChoices = getChoices(store.getState());
      if (newChoices) {
        this.emit('PickACard', newChoices);
      } else if (store.getState().gameEndResults) {
        this.emit('EndOfGame', store.getState().gameEndResults);
      }
    } else if (choices) {
      this.emit('NotAValidCard', choices);
    } else {
      // TODO: real error handling
      this.emit('NotANum');
    }
  },
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
  PickACard(cardChoices) {
    const choiceNames = _.map(
      _.values(cardChoices.playerCards),
      value => value.name);
    const choices = choiceNames.join(', or ');
    if (choiceNames.length > 0) {
      this.emit(':ask', `We currently have readied ${choiceNames.length} tactics for you to choose between. Would you like to deploy ${choices}?`, `Pick either ${choices}.`);
    } else {
      // TODO: handle when we run out of choices
      this.emit(':ask', 'You are currently out of tactics to deploy. Say <break strength="x-strong"/> um <break strength="x-strong"/> Mike please fix this.');
    }
  },
  EndOfGame(gameEndResults) {
    this.handler.state = states.STARTMODE;
    this.attributes.gamesPlayed += 1;
    const playAgainMsg = 'Thank you for playing! Would you like to play again?';
    if (gameEndResults.playerShipDefeat) {
      this.emit(':ask', `${'<say-as interpret-as="interjection">Great scott!</say-as> The ship has been irreversably damaged! We are going down!'
          + ' <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />'}${
           playAgainMsg}`);
    } else if (gameEndResults.playerShipVictory) {
      this.emit(':ask', `Good job! We have detroyed the enemy ship!${
           playAgainMsg}`);
    } else if (gameEndResults.playerPlanetVictory) {
      this.emit(':ask', `Victory is ours! We have taken control of the planet!${
           playAgainMsg}`);
    } else if (gameEndResults.playerPlanetDefeat) {
      this.emit(':ask', `We have lost the planet to the enemy. We must retreat before they set up planet to orbit missile barage!${
           playAgainMsg}`);
    } else if (gameEndResults.playerTiebreakerVictory) {
      this.emit(':ask', `${'The ship is going down but it looks like we took them out too and have taken the planet. Our sacrifice will not be in vain!'
          + ' <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />'}${
           playAgainMsg}`);
    } else if (gameEndResults.playerTiebreakerDefeat) {
      this.emit(':ask', `${'Both ours and the enemy\'s ship is going down, but it looks like they are taking the planet. <say-as interpret-as="interjection">Phooey!</say-as>'
          + ' <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />'}${
           playAgainMsg}`);
    } else if (gameEndResults.drawShipsDestroyed) {
      this.emit(':ask', `${'Looks like no one gets the planet today, both ours and the enemy\'s ship are going down!'
          + ' <audio src="https://s3.amazonaws.com/sensorsaredown-static-files/mp3/explosion.mp3" />'}${
           playAgainMsg}`);
    } else if (gameEndResults.drawStalemate) {
      this.emit(':ask', `Huh, looks like we both ran out of steam. Today may be a draw but we will be back to take this planet!${
           playAgainMsg}`);
    }
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
  alexa.appId = config.get('deployment.appId');
  alexa.dynamoDBTableName = config.get('db.tableName');
  alexa.registerHandlers(newSessionHandlers,
    guessModeHandlers,
    startGameHandlers,
    guessAttemptHandlers);
  alexa.execute();
};
