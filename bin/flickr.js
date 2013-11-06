#!/usr/bin/env node
'use strict'; /*jslint es5: true, node: true, indent: 2 */
var async = require('async');
var flickr = require('flickr-with-uploads');
var fs = require('fs');
var logger = require('winston');
var path = require('path');
var flickr_sync = require('../index');
var eye = require('eyes').inspector({stream: process.stderr});
var _ = require('underscore');

function select(object, path) {
  if (path) {
    var props = path.split('.');
    for (var i = 0, prop; (prop = props[i]); i++) {
      object = object[prop];
    }
  }
  return object;
}

function testCommand(api, optimist) {
  api({method: 'flickr.test.login'}, function(err, obj) {
    console.log(JSON.stringify(obj, null, '  '));
  });
}

function apiCommand(api, optimist) {
  var argv = optimist.demand(['method']).argv;

  var printResponse = function(err, obj) {
    if (err) logger.error(err);

    obj = select(obj, argv.select);
    if (Array.isArray(obj)) {
      obj.forEach(function(item) {
        console.log(JSON.stringify(item, null));
      });
    }
    else {
      console.log(JSON.stringify(obj, null));
    }
  };

  var handleParams = function(pairs) {
    var params = {method: argv.method};
    pairs.map(function(arg) {
      var pair = arg.match('(.+)=(.+)');
      params[pair[1]] = pair[2];
    });
    // if a path is given, swap it out for the a stream
    if (params.photo) {
      params.photo = fs.createReadStream(params.photo);
    }
    api(params, printResponse);
  };

  // if there is data from stdin, use each line
  if (!process.stdin.isTTY) {
    process.stdin.pipe(new flickr_sync.LineStream())
    .on('error', function(err) {
      throw err;
    })
    .on('data', function(line) {
      // note that this will send all requests off in parallel
      handleParams(line.trim().split(/\s+/g));
    })
    .on('end', function(line) {
      logger.info('Finished reading STDIN');
    });
  }
  else {
    // otherwise read parameters from command line
    handleParams(argv._.slice(1));
  }
}

function syncCommand(api, optimist) {
  var argv = optimist.demand(['directory']).argv;
  flickr_sync.sync(api, argv.directory, argv.workers, function(err) {
    logger.info('Finished; all photos have been processed');
  });
}

var commands = {
  test: testCommand,
  api: apiCommand,
  sync: syncCommand,
};

function main() {
  var optimist = require('optimist')
    .usage('Usage: flickr <command> [options]')
    .describe({
      workers: 'number of workers to use',
      credentials: 'filepath with flickr credentials',
      directory: 'directory with subfolders that will be uploaded as photosets',

      select: 'response property to output when using the api',

      help: 'print this help message',
      verbose: 'print extra output',
      version: 'print version',
    })
    .boolean(['test', 'help', 'verbose', 'version'])
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

  if (argv.help) {
    optimist.showHelp();
    console.error('e.g.,');
    console.error('  flickr sync --directory ~/Pictures/Photos --workers 5');
    console.error('  flickr api -m flickr.test.login');
  }
  else if (argv.version) {
    console.log(require('../package').version);
  }
  else {
    var credentials_filepath = argv.credentials.replace(/^~/, process.env.HOME);
    fs.readFile(credentials_filepath, 'utf8', function(err, data) {
      var credentials = JSON.parse(data);

      var plain_api = flickr(
        credentials.consumer_key,
        credentials.consumer_secret,
        credentials.oauth_token,
        credentials.oauth_token_secret);

      var wrapped_api = function(opts, callback) {
        eye(opts, 'Flickr API request');
        plain_api(opts, function(err, response_object) {
          eye(response_object, 'Flickr API response');
          callback(err, response_object);
        });
      };

      optimist = optimist.demand(1).check(function(argv) {
        var name = argv._[0];
        if (commands[name] === undefined) {
          var message = 'The command, "' + name + '", is invalid. ';
          message += 'Valid commands are: "' + Object.keys(commands).join('", "') + '"';
          throw new Error(message);
        }
      });

      argv = optimist.argv;

      commands[argv._[0]](argv.verbose ? wrapped_api : plain_api, optimist);
    });
  }
}

if (require.main === module) { main(); }
