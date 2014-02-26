#!/usr/bin/env node
'use strict'; /*jslint es5: true, node: true, indent: 2 */
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('loge');

var flickr = require('..');

function main() {
  var optimist = require('optimist')
    .usage([
      'Usage: flickr <command> [options]',
      '',
      'commands:',
      '  test: Call "flickr.test.login" to verify connection and credentials',
      '  api: Call a specific Flickr API method',
      '  cleanup: Merge photosets with identical names',
      '  sync: Upload photos and place them into photosets',
    ].join('\n'))
    .describe({
      workers: 'number of workers to use',
      credentials: 'filepath to json file containing flickr credentials',

      help: 'print this help message',
      verbose: 'print extra output',
      version: 'print version',
    })
    .boolean(['help', 'verbose', 'version'])
    .alias({
      verbose: 'v',
      method: 'm',
    })
    .default({
      workers: 10,
      credentials: '~/.flickr',
    });

  var argv = optimist.argv;
  logger.level = argv.verbose ? 'debug' : 'info';

  if (argv.version) {
    console.log(require('../package').version);
  }
  else {
    // if not --version, require a command string

    // `./flickr-commands.js` currently exports test, api, sync methods, all of which have the signature:
    //   function(request, optimist), where request is a function with the signature:
    //     function(opts, callback), where opts is a javascript object of API request parameters
    //   and optimist is the fully configured optimist object
    var commands = require('./flickr-commands');
    optimist = optimist.demand(1).check(function(argv) {
      var command = argv._[0];
      if (commands[command] === undefined) {
        logger.warn('The command, "%s", is invalid. Valid commands: %s.',
          command, Object.keys(commands).join(', '));
        logger.warn([
          '',
          'Examples',
          '',
          '    flickr sync --directory ~/Pictures/Photos --workers 5',
          '    flickr api -m flickr.photosets.getList',
          '    flickr test',
          '',
        ].join('\n'));
        throw new Error('CLI usage error');
      }
    });

    argv = optimist.argv;
    var command = argv._[0];

    // maybe show more elaborate help for the specified command?
    if (argv.help) return optimist.showHelp();

    var credentials_filepath = argv.credentials.replace(/^~/, process.env.HOME);
    fs.readFile(credentials_filepath, 'utf8', function(err, data) {
      var credentials = JSON.parse(data);

      var request = flickr(
        credentials.consumer_key,
        credentials.consumer_secret,
        credentials.oauth_token,
        credentials.oauth_token_secret);

      // let it loose!
      commands[command](request, optimist);
    });
  }
}

if (require.main === module) main();
