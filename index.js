const Alexa = require('alexa-sdk');
const config = require('config');
const _ = require('lodash');
const engine = require('./lib/engine');
const speeches = require('./lib/speeches');
const unstackSpeech = require('./lib/unstackSpeech');
const strings = require('./strings/strings.yaml');

const states = {
  GAMEMODE: '_GAMEMODE', // User is playing the game.
  STARTMODE: '_STARTMODE', // Prompt the user to start or restart the game.
};

const newSessionHandlers = {
  NewSession() {
    if (Object.keys(this.attributes).length === 0) {
      this.attributes.gamesPlayed = 0;
      this.attributes.gameState = null;
    }
    this.handler.state = states.STARTMODE;
    this.emit(':ask', strings.welcome.output, strings.welcome.reprompt);
  },
  'AMAZON.StopIntent': function StopIntent() {
    this.emit(':tell', strings.goodbye);
  },
  'AMAZON.CancelIntent': function CancelIntent() {
    this.emit(':tell', strings.goodbye);
  },
  SessionEndedRequest() {
    console.log('session ended!');
    this.emit(':tell', strings.goodbye);
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
    this.handler.state = states.GAMEMODE;
    const store = engine.init(this.attributes.gameState);
    store.dispatch(engine.startGame());
    this.attributes.gameState = store.getState();
    console.log('Player deck:');
    console.log(JSON.stringify(store.getState().game.playerDeck));
    this.emit('PickACard', '', store.getState());
  },
  'AMAZON.NoIntent': function NoIntent() {
    console.log('NOINTENT');
    this.emit(':tell', strings.goodbye);
  },
  HowToPlayIntent() {
    console.log('HowToPlayIntent');
    const speechObj = unstackSpeech([
      strings.howToPlay,
      '<break strength="x-strong" />',
      {
        output: strings.doYouWantToPlay,
        reprompt: strings.welcome.reprompt,
      },
    ]);
    this.emit(':ask', speechObj.output);
  },
  'AMAZON.StopIntent': function StopIntent() {
    console.log('STOPINTENT');
    this.emit(':tell', strings.goodbye);
  },
  'AMAZON.CancelIntent': function CancelIntent() {
    console.log('CANCELINTENT');
    this.emit(':tell', strings.goodbye);
  },
  SessionEndedRequest() {
    console.log('SESSIONENDEDREQUEST');
    this.emit(':tell', strings.goodbye);
  },
  Unhandled() {
    console.log('UNHANDLED');
    const message = 'Say yes to continue, or no to end the game.';
    this.emit(':ask', message, message);
  },
});

const gameModeHandlers = Alexa.CreateStateHandler(states.GAMEMODE, {
  NewSession() {
    this.handler.state = '';
    this.emitWithState('NewSession'); // Equivalent to the Start Mode NewSession handler
  },
  // TODO: add intent for choosing not to defend
  CardSelectIntent() {
    const cardSelected = this.event.request.intent.slots.card.value.toLowerCase();
    const store = engine.init(this.attributes.gameState);
    const choices = speeches.getChoices(store.getState());
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
      const speechObj = unstackSpeech([
        speeches.unknown,
      ], store.getState());
      this.emit(':ask', speechObj.output, speechObj.reprompt);
    }
  },
  DescribeIntent() {
    console.log('Describe intent');
    const store = engine.init(this.attributes.gameState);
    const cardChoices = speeches.getChoices(store.getState());
    let messageSoFar = '';
    // TODO: also describe the opponent's offensive choice when defending
    const choiceDescs = _.map(
      _.values(cardChoices.playerCards),
      value => value.description);
    messageSoFar += [...choiceDescs, ''].join(' <break strength="x-strong" /> ');

    this.emit('PickACard', messageSoFar, store.getState());
  },
  // TODO: add yes intent for when there is only one choice to deploy
  'AMAZON.HelpIntent': function HelpIntent() {
    console.log('Help intent');
    const store = engine.init(this.attributes.gameState);
    const speechObj = unstackSpeech([
      strings.howToPlay,
      '<break strength="x-strong" />',
    ], store.getState());
    this.emit('PickACard', speechObj.output, store.getState());
  },
  'AMAZON.StopIntent': function StopIntent() {
    console.log('STOPINTENT');
    this.emit(':tell', strings.goodbye);
  },
  'AMAZON.CancelIntent': function CancelIntent() {
    console.log('CANCELINTENT');
  },
  SessionEndedRequest() {
    console.log('SESSIONENDEDREQUEST');
    this.attributes.endedSessionCount += 1;
    this.emit(':tell', strings.goodbye);
  },
  Unhandled() {
    console.log('UNHANDLED');
    const store = engine.init(this.attributes.gameState);
    const speechObj = unstackSpeech([
      speeches.unknown,
    ], store.getState());
    this.emit(':ask', speechObj.output, speechObj.reprompt);
  },
});

// These handlers are not bound to a state
const statelessHandlers = {
  DescribeRecentState(messageSoFarArg, state) {
    const messageSoFar = unstackSpeech([
      messageSoFarArg,
      speeches.describeRecentState(state),
    ], state);
    const newChoices = speeches.getChoices(state);
    if (newChoices) {
      this.emit('PickACard', messageSoFar.output, state);
    } else if (state.game.gameEndResults) {
      this.emit('EndOfGame', messageSoFar.output, state.game.gameEndResults);
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
  PickACard(messageSoFar, state) {
    // TODO: possibly convert this intent calling other intents to just a loop
    // note that pcik a card is a bit of a misnomer.
    // It does tell you to pick a card but it also will run the engine automatically
    // if there is no card to play. This intent could almost be called "runEngine".
    console.log('Pick a card intent');
    const cardChoices = speeches.getChoices(state);
    const noChoices = Object.keys(cardChoices.playerCards).length === 0;
    if (noChoices) {
      this.emit('PlayAutomatically', messageSoFar);
    } else {
      const speechObj = unstackSpeech([
        messageSoFar,
        speeches.pickACard(state),
      ], state);
      this.emit(':ask', speechObj.output, speechObj.reprompt);
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
    this.emit(':ask', `${messageSoFar} ${gameResultMsg} ${playAgainMsg}`);
  },
  NotAValidCard(cardChoices) {
    const choiceNames = _.map(
      _.values(cardChoices.playerCards),
      value => value.name);
    const choices = choiceNames.join(' or saying deploy ');
    this.emit(':ask', `Sorry, I didn't get that. Try saying deploy ${choices}.`, `Try saying deploy ${choices}.`);
  },
};

// eslint-disable-next-line no-unused-vars
exports.handler = function handler(event, context, callback) {
  const alexa = Alexa.handler(event, context);
  alexa.appId = config.deployment.appId;
  alexa.dynamoDBTableName = config.db.tableName;
  alexa.registerHandlers(newSessionHandlers,
    gameModeHandlers,
    startGameHandlers,
    statelessHandlers);
  alexa.execute();
};
