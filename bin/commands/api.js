/*jslint node: true */
var fs = require('fs');
var streaming = require('streaming');
var logger = require('loge');
var _ = require('lodash');
var flickr = require('../..');

// var printResponse = function(err, obj) {
//   if (err) logger.error(err);

//   obj = response.select(obj, argv.select);
//   if (Array.isArray(obj)) {
//     obj.forEach(function(item) {
//       console.log(JSON.stringify(item, null));
//     });
//   }
//   else {
//     console.log(JSON.stringify(obj, null));
//   }
// };

var parseArgs = function(args) {
  var params = {};
  // Convert a list like ['perPage=100', 'q=cat'] to a hash: {perPage: '100', q: 'cat'}
  args.map(function(arg) {
    var pair = arg.match('(.+)=(.+)');
    params[pair[1]] = pair[2];
  });
  // convert a photo's filepath to a Node file stream
  if (params.photo) {
    params.photo = fs.createReadStream(params.photo);
  }
  return params;
};


module.exports = function(optimist) {
  optimist = optimist.describe({
    // select: 'property in response to output',
  }).demand(['method']);

  var argv = optimist.argv;
  flickr.fromFilepath(argv.credentials, function(err, request) {
    if (err) throw err;

    var callArgs = function(args) {
      // default to the specified --method for all calls, but let it be overridden
      var params = _.extend({method: argv.method}, parseArgs(args));
      // params.method = 'POST';
      request(params, function(err, result) {
        if (err) return logger.error('flickr request error:', err);
        // if (Array.isArray(obj)) {
        //   obj.forEach(function(item) {
        //     console.log(JSON.stringify(item, null));
        //   });
        // }
        // else {
        // console.log(JSON.stringify(result, null, '  '));
        console.log(JSON.stringify(result, null));
        // }
      });
    };

    if (!process.stdin.isTTY) {
      // if there is data from stdin, use each line
      process.stdin.pipe(new streaming.Splitter())
      .on('error', function(err) {
        logger.error('Error reading from STDIN: %s', err);
        process.exit(1);
      })
      .on('data', function(line) {
        // note that this will send all requests off in parallel
        callArgs(line.trim().split(/\s+/g));
      })
      .on('end', function() {
        logger.info('Finished reading STDIN');
      });
    }
    else {
      // otherwise read parameters from command line
      callArgs(argv._.slice(1));
    }
  });
};
