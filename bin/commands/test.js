/*jslint node: true */
var logger = require('loge');
var flickr = require('../..');

module.exports = function(optimist) {
  flickr.fromFilepath(optimist.argv.credentials, function(err, request) {
    if (err) return logger.error(err);

    request({method: 'flickr.test.login'}, function(err, obj) {
      if (err) return logger.error(err);

      console.log(JSON.stringify(obj, null, '  '));
    });
  });
};
