'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var async = require('async');
var logger = require('../lib/logger');

var Photoset = require('./photoset');
var Photo = require('./photo');

var User = module.exports = function(api, user_id) {
  /** User: basically the Flickr client, but since each client is associated
    with a single user (the "me" user), we instantiate it as a User object.

  api: initialized Flickr client request function
  */
  this.api = api;
  this.id = user_id === undefined ? 'me' : user_id;

  // _cached_photosets is a map from photoset titles to existing photosets (which are maybe pending)
  this._cached_photosets = {};
};

User.prototype.getCoverPhoto = function(callback) {
  /**
  callback: function(Error | null, Photo | null)
  */
  // get the backup-cover-photo (Flickr requires photosets to have cover photos)
  this.api({method: 'flickr.photos.search', user_id: this.id, tags: 'api'}, function(err, res) {
    if (err) return callback(err);

    var raw_photo = res.photos.photo[0];
    logger.debug('Calling Photo.fromJSON(%j)', raw_photo);
    var photo = Photo.fromJSON(raw_photo);
    logger.debug('Using cover_photo for all backups: %s', photo.id);
    callback(null, photo);
  });
};

User.prototype.getPhotosets = function(callback) {
  /**
  callback: function(Error | null, [Photoset] | null)
  */
  var self = this;
  this.api({method: 'flickr.photosets.getList', per_page: 500}, function(err, res) {
    if (err) return callback(err);

    var photosets = res.photosets.photoset.map(Photoset.fromJSON);
    logger.debug('Found %d photosets.', photosets.length);

    callback(null, photosets);
  });
};

User.prototype.getPhotoset = function(photoset_title, callback) {
  /** Make or grab an existing photoset from Flickr.

  Requires that .photosets and .cover_photo have been populated.

  This function must be truly async because it's used as a streaming.Queue worker.

  callback: function(Error | null, Photoset | null)
  */
  // 1. try the photoset cache first
  if (this._cached_photosets[photoset_title]) {
    var cached_photoset = this._cached_photosets[photoset_title];
    // photoset.initialize must be truly async
    cached_photoset.initialize(this.api, function(err) {
      if (err) {
        logger.error('Error initializing cached_photoset: %j', err);
        return callback(err);
      }

      callback(null, cached_photoset);
    });
  }
  // 2. try to find / make a new photoset
  else {
    var photoset = new Photoset(null, photoset_title, 'flickr-sync', this.cover_photo.id, 0);

    for (var i = 0, current_photoset; (current_photoset = this.photosets[i]); i++) {
      if (current_photoset.title == photoset_title) {
        photoset = current_photoset;
      }
    }

    this._cached_photosets[photoset_title] = photoset;
    photoset.initialize(this.api, function(err) {
      if (err) {
        logger.error('Error initializing created / found photoset: %j', err);
        console.trace();
        return callback(err);
      }

      callback(null, photoset);
    });
  }
};
