/*jslint node: true */
var async = require('async');
var util = require('util');
var events = require('events');
var logger = require('loge');

var Photoset = require('./photoset');
var Photo = require('./photo');

var User = module.exports = function(api, user_id) {
  /** User: basically the Flickr client, but since each client is associated
    with a single user (the "me" user), we instantiate it as a User object.

  api: initialized Flickr client request function
  */
  events.EventEmitter.call(this);

  this.api = api;
  this.id = user_id === undefined ? 'me' : user_id;

  // _photosets: a map from photoset titles to existing photosets.
  // it is set when ready() is called
  this._photosets = false;
  this._ready_pending = false;
};
util.inherits(User, events.EventEmitter);

User.prototype.ready = function(callback) {
  /** user.ready: ensure that we have fetched all the photosets currently on Flickr.
  (We don't want to create duplicates, but if the user creates such a photoset after this runs, too bad.)

  Consistently asynchronous.

  callback: function(Error | null)
  */
  if (this._photosets) {
    setImmediate(callback);
  }
  else {
    this.on('ready', callback);

    if (!this._ready_pending) {
      this._ready_pending = true;

      var self = this;
      this.api({method: 'flickr.photosets.getList', per_page: 500}, function(err, res) {
        if (err) return callback(err);

        // photosets are now all real Photoset objects, but they are not yet initialized
        var photosets = res.photosets[0].photoset.map(Photoset.fromJSON);
        logger.debug('Found %d photosets.', photosets.length);

        self._photosets = {};
        photosets.forEach(function(photoset) {
          photoset.api = self.api;
          self._photosets[photoset.title] = photoset;
        });

        self.emit('ready');
      });
    }
  }
};

User.prototype.findOrCreatePhoto = function(photo_title, photoset_title, filepath, callback) {
  /** If the photoset already exists, and contains the photo, return that Photo object.

  Otherwise, upload the photo, create the photoset, and fetch the info for that photo.

  callback: function(Error | null, Photo | null, Photoset | null)
  */
  var self = this;
  this.ready(function(err) {
    if (err) return callback(err);

    // 1. see if the photoset exists
    var photoset = self._photosets[photoset_title];
    if (photoset) {
      // 2a. now see if the photo already exists in the photoset
      photoset.ready(function(err) {
        if (err) return callback(err);
        var photo = photoset._photos[photo_title];
        if (photo) {
          // 2b. we have already uploaded it. so chill.
          logger.debug('Found photo "%s" already exists in photoset "%s"', photo.title, photoset.title);
          callback(null, photo, photoset);
        }
        else {
          // 2c. got the photoset, just need to upload the photo.
          photo = new Photo(null, photo_title, 0, 0, 0, filepath);
          photo.api = self.api;
          photo.ready(function(err) {
            if (err) return callback(err);

            logger.debug('Adding photo "%s" to photoset "%s"', photo.title, photoset.title);
            photoset.addPhoto(photo, function(err) {
              if (err) return callback(err);

              callback(null, photo, photoset);
            });
          });
        }
      });
    }
    else {
      // 3a. immediately create the photoset, but don't initialize it yet.
      // function(id, title, description, primary_photo_id, size) {
      var now_string = new Date().toISOString().replace('T', ' ').split('.')[0];
      var description = 'Created by flickr sync on ' + now_string;
      // new Photoset(id, title, description, cover photo id, size = # of photos + # of videos)
      photoset = new Photoset(null, photoset_title, description, null, 0);
      photoset.api = self.api;
      // the _ready_pending is a total hack here.
      photoset._ready_pending = true;
      self._photosets[photoset_title] = photoset;

      // 3b. now upload the photo, before we require that the photoset is ready
      // new Photo(id, title, is_public, is_friend, is_family, filepath) {
      var photo = new Photo(null, photo_title, 0, 0, 0, filepath);
      photo.api = self.api;
      photo.ready(function(err) {
        if (err) return callback(err);

        // 3c. set that brand new photo as the cover
        photoset.primary_photo = photo;
        // how to do this _ready_pending better?
        photoset._ready_pending = false;
        photoset.ready(function(err) {
          if (err) return callback(err);

          callback(null, photo, photoset);
        });
      });
    }
  });
};
