const _ = require('lodash');

// function takes a stack of speech objects or nested speech stacks or
// functions that create speech stacks and turns it all into one returned
// set of output and reprompt strings
const unstackSpeech = (speechStack, state) => {
  const stack = speechStack ? [speechStack] : [];
  let iterations = 0;
  const acc = {
    output: [],
    reprompt: [],
  };
  while (stack.length && stack.length > 0) {
    const unit = stack.shift();
    if (typeof unit === 'function') {
      stack.unshift(unit(state));
    } else if (_.isArray(unit)) {
      // this will unshift the elements of an array into this array
      Array.prototype.unshift.apply(stack, unit);
    } else if (typeof unit === 'object') {
      if (typeof unit.output === 'string') {
        acc.output.push(unit.output);
      }
      if (typeof unit.reprompt === 'string') {
        acc.reprompt.push(unit.reprompt);
      }
    } else if (typeof unit === 'string') {
      acc.output.push(unit);
    } else {
      console.warn(`Unexpected SpeechStack type: ${unit}`);
    }

    iterations += 1;
    if (iterations > 400) {
      throw new Error('SpeechStack ran too many iterations');
    }
  }
  return {
    output: acc.output.join(' '),
    reprompt: acc.reprompt.join(' '),
  };
};

module.exports = unstackSpeech;
