const fs = require('fs');
const path = require('path');
const cards = require('../loaders/cards');

const fileData = Object.keys(cards).map(cardId => `${cards[cardId].name}\n`).join('');
fs.writeFileSync(path.resolve(__dirname, 'CardCustomSlotType.txt'), fileData);

console.log('Wrote CardCustomSlotType.txt successfully.');
