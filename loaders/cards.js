const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

module.exports = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, '../data/cards.yaml'), 'utf8'));
