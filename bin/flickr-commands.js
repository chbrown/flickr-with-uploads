'use strict'; /*jslint es5: true, node: true, indent: 2 */
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('loge');

var response = require('../lib/response');
var streaming = require('streaming');

var orm = require('../orm');

// Exported commands:

var test = exports.test = function(request, optimist) {
  request({method: 'flickr.test.login'}, function(err, obj) {
    console.log(JSON.stringify(obj, null, '  '));
  });
};

var api = exports.api = function(request, optimist) {
  optimist.describe({
    select: 'property in response to output',
  });

  var argv = optimist.demand(['method']).argv;

  var printResponse = function(err, obj) {
    if (err) logger.error(err);

    obj = response.select(obj, argv.select);
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
    // if a path is given, swap it out for a file stream
    if (params.photo) {
      params.photo = fs.createReadStream(params.photo);
    }
    request(params, printResponse);
  };

  // if there is data from stdin, use each line
  if (!process.stdin.isTTY) {
    process.stdin.pipe(new streaming.Splitter())
    .on('error', function(err) {
      logger.error('Error reading from STDIN: %s', err);
      process.exit(1);
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
};

exports.cleanup = function(request, optimist) {
  // for now, this will simply merge photosets of the same name
  request({method: 'flickr.photosets.getList'}, function(err, res) {
    if (err) return logger.error('Error calling Flickr API: %s', err);

    var photosets = res.photosets.photoset.map(orm.Photoset.fromJSON);
    // photosets are now orm.Photoset instance
    logger.debug('Looking for duplicates in %d photosets', photosets.length);

    var groups = {};
    photosets.forEach(function(photoset) {
      // if (groups[photoset.title] === undefined) groups[photoset.title] = [];
      groups[photoset.title] = (groups[photoset.title] || []).concat(photoset);
    });

    var duplicates = []; // duplicates is a list of lists of photosets with the same title
    for (var title in groups) {
      if (groups[title].length > 1) {
        duplicates.push(groups[title]);
      }
    }

    async.each(duplicates, function(photosets, callback) {
      logger.info('Merging %d photosets named "%s"', photosets.length, photosets[0].title);
      orm.Photoset.merge(request, photosets, callback);
    }, function(err) {
      if (err) return logger.error(err);

      logger.info('Done');
    });
  });
};

exports.sync = require('./flickr-commands-sync');
