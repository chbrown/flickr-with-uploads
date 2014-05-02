#!/usr/bin/env node
/*jslint node: true */
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('loge');

var flickr = require('..');

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
  // Require a command, corresponding to the files in ./commands,
  // each of which export a single function with the signature:
  //   function(optimist)
  // where optimist is the fully configured optimist object.
  var commands = {
    api: require('./commands/api'),
    sync: require('./commands/sync'),
    cleanup: require('./commands/cleanup'),
    test: require('./commands/test'),
  };

  optimist = optimist.check(function(argv) {
    var command = commands[argv._[0]];
    if (command === undefined) {
      logger.warn('The command, "%s", is invalid. Valid commands: %s.',
        argv._[0], Object.keys(commands).join(', '));
      logger.warn([
        '',
        'Examples',
        '',
        '    flickr sync --directory ~/Pictures/Photos --workers 5',
        '    flickr api -m flickr.photosets.getList',
        '    flickr test',
        '',
      ].join('\n'));
      throw new Error('No command specified');
    }
  });

  argv = optimist.argv;
  var command = commands[argv._[0]];

  // maybe show more elaborate help for the specified command?
  if (argv.help) return optimist.showHelp();

  command(optimist);
}
