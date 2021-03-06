const Alexa = require('alexa-sdk');
const config = require('config');
const engine = require('./lib/engine');
const speeches = require('./lib/speeches');
const unstackSpeech = require('./lib/unstackSpeech');
const strings = require('./data/strings.yaml');

const states = {
  GAMEMODE: '_GAMEMODE', // User is playing the game.
  FIRSTSTARTMODE: '_FIRSTSTARTMODE', // Prompt the user to learn to play or start the game.
  STARTMODE: '_STARTMODE', // Prompt the user to start or restart the game.
  RESUMEMODE: '_RESUMEMODE', // Prompt the user to start or restart the game.
};

// These handlers are not bound to a state
const statelessHandlers = {
  HowToPlayIntent() {
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

const newSessionHandlers = {
  NewSession() {
    if (Object.keys(this.attributes).length === 0) {
      this.attributes.gamesPlayed = 0;
      this.attributes.gameState = null;
    }
    if (this.attributes.gameState && !this.attributes.gameState.game.gameEndResults) {
      this.handler.state = states.RESUMEMODE;
      this.emit(':ask', `${strings.welcome.output} ${strings.welcome.resumePrompt}`,
          strings.welcome.resumeReprompt);
    } else if (this.attributes.gamesPlayed === 0) {
      this.handler.state = states.FIRSTSTARTMODE;
      this.emit(':ask', `${strings.welcome.output} ${strings.welcome.firstTimePrompt}`,
          strings.welcome.firstTimeReprompt);
    } else {
      this.handler.state = states.STARTMODE;
      this.emit(':ask', `${strings.welcome.output} ${strings.welcome.prompt}`,
          strings.welcome.reprompt);
    }
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

/* eslint-disable no-param-reassign */
const doRunGame = (scope, resume) => {
  scope.handler.state = states.GAMEMODE;
  const store = engine.init(scope.attributes.gameState);
  if (!resume) {
    store.dispatch(engine.startGame());
  }
  scope.attributes.gameState = store.getState();
  console.log('Player deck:');
  console.log(JSON.stringify(store.getState().game.playerDeck));
  scope.emit('RunGame');
};
/* eslint-enable no-param-reassign */

const baseStartModeHandlers = {
  NewSession() {
    this.emit('NewSession'); // Uses the handler in newSessionHandlers
  },
  'AMAZON.HelpIntent': function HelpIntent() {
    this.emit('HowToPlayIntent');
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
    console.log(this.event.request.intent);
    console.log(JSON.stringify(this.event));
    const message = 'Say yes to continue, or no to end the game.';
    this.emit(':ask', message, message);
  },
};

const firstTimeStartGameHandlers = Alexa.CreateStateHandler(states.FIRSTSTARTMODE, {
  ...statelessHandlers,
  ...baseStartModeHandlers,
  'AMAZON.YesIntent': function YesIntent() {
    // Would you like to hear how to play? Yes.
    this.handler.state = states.STARTMODE;
    this.emit('HowToPlayIntent');
  },
  'AMAZON.NoIntent': function NoIntent() {
    // Would you like to hear how to play? No.
    doRunGame(this);
  },
});

const startGameHandlers = Alexa.CreateStateHandler(states.STARTMODE, {
  ...statelessHandlers,
  ...baseStartModeHandlers,
  'AMAZON.YesIntent': function YesIntent() {
    // Would you like to play? Yes.
    doRunGame(this);
  },
  'AMAZON.NoIntent': function NoIntent() {
    // Would you like to play? No.
    this.emit(':tell', strings.goodbye);
  },
});

const resumeGameHandlers = Alexa.CreateStateHandler(states.RESUMEMODE, {
  ...statelessHandlers,
  ...baseStartModeHandlers,
  'AMAZON.YesIntent': function YesIntent() {
    // Would you like to resume? Yes.
    doRunGame(this, true);
  },
  'AMAZON.NoIntent': function NoIntent() {
    // Would you like to resume? No means new game.
    this.attributes.gameState = null;
    doRunGame(this);
  },
});

const gameModeHandlers = Alexa.CreateStateHandler(states.GAMEMODE, {
  ...statelessHandlers,
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
    const speechObj = unstackSpeech([
      speeches.describeChoiceCards,
    ], store.getState());
    this.emit('RunGame', speechObj.output);
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
    console.log(this.event.request.intent);
    console.log(JSON.stringify(this.event));
    const store = engine.init(this.attributes.gameState);
    const speechObj = unstackSpeech([
      speeches.unknown,
    ], store.getState());
    this.emit(':ask', speechObj.output, speechObj.reprompt);
  },
});

// eslint-disable-next-line no-unused-vars
exports.handler = function handler(event, context, callback) {
  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = config.deployment.appId;
  alexa.dynamoDBTableName = config.db.tableName;
  alexa.registerHandlers(newSessionHandlers,
    gameModeHandlers,
    firstTimeStartGameHandlers,
    startGameHandlers,
    resumeGameHandlers,
    statelessHandlers);
  alexa.execute();
};
