const fs = require('fs');
const path = require('path');
const config = require('config');
const rimraf = require('rimraf');
const BabiliPlugin = require('babili-webpack-plugin');

// This will take the config based on the current NODE_ENV and save it to 'build/client.json'
// The webpack alias below will then build that file into the client build.
rimraf.sync('build');
fs.mkdirSync(path.resolve(__dirname, 'build'));
fs.writeFileSync(path.resolve(__dirname, 'build/config.json'), JSON.stringify(config));

module.exports = {
  // entry: set by the plugin
  // output: set by the plugin
  target: 'node',
  externals: [
    /aws-sdk/, // Available on AWS Lambda
  ],
  plugins: [
    new BabiliPlugin(),
  ],
  resolve: {
    alias: {
      config: path.resolve(__dirname, 'build/config.json'),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ],
  },
};
