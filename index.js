const Alexa = require('alexa-sdk');
const config = require('config');
const _ = require('lodash');
const engine = require('./lib/engine');
const speeches = require('./lib/speeches');
const unstackSpeech = require('./lib/unstackSpeech');
const strings = require('./data/strings.yaml');

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
    this.emit('RunGame');
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
    this.emit(':ask', speechObj.output, speechObj.reprompt);
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
    const speechObj = engine.selectCard(cardSelected);

    // update session info based on engine changes
    this.attributes.gameState = store.getState();
    if (store.getState().game.gameEndResults) {
      this.handler.state = states.STARTMODE;
      this.attributes.gamesPlayed += 1;
    }

    this.emit(':ask', speechObj.output, speechObj.reprompt);
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

    this.emit('RunGame', messageSoFar);
  },
  // TODO: add yes intent for when there is only one choice to deploy
  'AMAZON.HelpIntent': function HelpIntent() {
    console.log('Help intent');
    const store = engine.init(this.attributes.gameState);
    const speechObj = unstackSpeech([
      strings.howToPlay,
      '<break strength="x-strong" />',
    ], store.getState());
    this.emit('RunGame', speechObj.output);
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
  RunGame(messageSoFar) {
    const store = engine.init(this.attributes.gameState);
    const speechObj = engine.run(messageSoFar);

    // update session info based on engine changes
    this.attributes.gameState = store.getState();
    if (store.getState().game.gameEndResults) {
      this.handler.state = states.STARTMODE;
      this.attributes.gamesPlayed += 1;
    }

    this.emit(':ask', speechObj.output, speechObj.reprompt);
  },
};

// eslint-disable-next-line no-unused-vars
exports.handler = function handler(event, context, callback) {
  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = config.deployment.appId;
  alexa.dynamoDBTableName = config.db.tableName;
  alexa.registerHandlers(newSessionHandlers,
    gameModeHandlers,
    startGameHandlers,
    statelessHandlers);
  alexa.execute();
};
