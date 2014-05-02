/*jslint node: true */
var async = require('async');
var logger = require('loge');
var orm = require('../../orm');
var flickr = require('../..');

module.exports = function(optimist) {
  /**
  Merge all photosets of the same name in the authenticating user's account.
  */
  flickr.fromFilepath(optimist.argv.credentials, function(err, request) {
    if (err) return logger.error(err);

    request({method: 'flickr.photosets.getList'}, function(err, res) {
      if (err) return logger.error('Error calling Flickr API: %s', err);

      var photosets = res.photosets[0].photoset.map(orm.Photoset.fromJSON);
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
  });
};
