const _ = require('lodash');
const engine = require('./lib/engine');
const speeches = require('./lib/speeches');
const { prompt } = require('inquirer');

const store = engine.init();
store.dispatch(engine.startGame());
const cardSelectedFunc = ({ choice: answer }) => {
  let cardSelected;
  if (_.toInteger(answer) > 0) {
    const choicesObj = speeches.getChoices(store.getState());
    cardSelected = _.values(choicesObj.playerCards)[_.toInteger(answer) - 1].name;
  } else if (typeof answer === 'string') {
    cardSelected = answer.toLowerCase();
  }
  if (cardSelected === 'dump' || cardSelected === 'state') {
    console.dir(store.getState(), { depth: 5 });
  }
  if (cardSelected && typeof cardSelected === 'string') {
    const speechObj = engine.selectCard(cardSelected, true);
    if (!store.getState().game.gameEndResults) {
      prompt([{ name: 'choice', message: speechObj.output, default: 1 }]).then((subAnswer) => {
        cardSelectedFunc(subAnswer);
      });
    } else {
      console.log(speechObj.output);
    }
  } else {
    // eslint-disable-next-line no-use-before-define
    runGame();
  }
};

const runGame = () => {
  const speechObj = engine.run('', true);
  if (!store.getState().game.gameEndResults) {
    prompt([{ name: 'choice', message: speechObj.output, default: 1 }]).then((answer) => {
      cardSelectedFunc(answer);
    });
  } else {
    console.log(speechObj.output);
  }
};
runGame();
