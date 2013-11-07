'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var fs = require('fs');
var util = require('util');
var events = require('events');
var async = require('async');
var logger = require('../lib/logger');

var Photo = require('./photo');

var Photoset = module.exports = function(id, title, description, primary_photo_id, size) {
  // the Flickr-assigned ID (maybe null)
  this.id = id;
  // the title._content value or folder name if the photoset is new
  this.title = title;
  // description._content, if any
  this.description = description;
  // primary
  this.primary_photo_id = primary_photo_id;
  // the number of photos + videos, if any
  this.size = size;

  // initialize event-making
  events.EventEmitter.call(this);
};
util.inherits(Photoset, events.EventEmitter);

Photoset.fromJSON = function(obj) {
  /** Photoset.fromJSON({id: '73...10', ...})

  A raw Photoset might look like this:

      {
        "id": "73805723521590545",
        "primary": "3035683619",
        "secret": "52bfc8d1d0",
        "server": "1350",
        "farm": 1,
        "photos": "184",
        "videos": 0,
        "title": {
          "_content": "Breakdance pants"
        },
        "description": {
          "_content": ""
        },
        "needs_interstitial": 0,
        "visibility_can_see_set": 1,
        "count_views": "14",
        "count_comments": "0",
        "can_comment": 1,
        "date_create": "1102975059",
        "date_update": "1323337004"
      }

  */
  // logger.debug('Photoset.fromJSON: %j', obj);
  var size = parseInt(obj.photos, 10) + parseInt(obj.videos, 10);
  return new Photoset(obj.id, obj.title._content, obj.description._content, obj.primary, size);
};

Photoset.prototype.create = function(api, callback) {
  /** Create a new photoset with this one's properties, even if .id is already set.

  callback: function(Error | null)
  */
  var self = this;
  logger.debug('Creating photoset, "%s"', this.title);
  api({
    method: 'flickr.photosets.create',
    title: this.title,
    description: this.description,
    primary_photo_id: this.primary_photo_id,
  }, function(err, res) {
    if (err) return callback(err);

    self.id = res.photoset.id;
    callback();
  });
};

Photoset.prototype.initialize = function(api, callback) {
  /** Ensure that the photoset exists on Twitter, and that we have fetched info about all its photos.

  If there is no available id, persist this photoset to Flickr.

  Consistently asynchronous.

  callback: function(Error | null)
  */
  var self = this;
  if (this.id && this.photos) {
    // we're all ready to go!
    // force async for the sake of consistency
    setImmediate(callback);
  }
  else if (this._initializing) {
    logger.debug('Waiting for photoset, "%s", to initialize', this.title);
    this.on('initialized', function() {
      // logger.debug('Photoset "%s" triggered initialized', this.title);
      callback();
    });
  }
  else {
    this._initializing = true;

    var fetchPhotos = function(err) {
      if (err) return callback(err);

      // this.id exists, now
      self.getPhotos(api, function(err, photos) {
        if (err) return callback(err);

        // this.id && this.photos is checked before this._initializing, so we can just abandon this._initializing
        self.photos = photos;
        self.emit('initialized');
      });
    };

    if (!this.id) {
      this.create(api, fetchPhotos);
    }
    else {
      // assume this.id exists
      fetchPhotos();
    }
  }
};

Photoset.prototype.getPhotos = function(api, callback) {
  /** Page through all available photos, assuming the photoset exists.

  Does not store the photos returned in the callback.

  callback: function(Error | null, [Photo] | null)
  */
  var self = this;
  var photos = [];
  // when syncing with the Flickr remote database, page_count is set to the
  // number of pages of photos available in this dataset.
  var page_count = 999;
  (function getPage(page_index) {
    // logger.debug('getPhotos.getPage: %d/%d', page_index, page_count);
    if (page_index <= page_count) {
      api({method: 'flickr.photosets.getPhotos', photoset_id: self.id, page: page_index}, function(err, res) {
        if (err) return callback(err);

        page_count = res.photoset.pages;

        // res.photoset.photo is an array of raw photo json objects
        // logger.debug('Got page: %j', res.photoset.photo, res.photoset.photo.map);
        var page_photos = res.photoset.photo.map(Photo.fromJSON);
        photos.push.apply(photos, page_photos);

        getPage(page_index + 1);
      });
    }
    else {
      // we've read all pages, so process the list of photos into the dictionary
      // logger.debug('Finished with photoset.getPhotos, found %d', photos.length);
      callback(null, photos);
    }
  })(1);
};

Photoset.prototype.findPhoto = function(title) {
  /**
  Requires that .photos (a list of Photo objects) is set already.

  returns a Photo if there is one matching this title, else, undefined.
  */
  for (var i = 0, photo; (photo = this.photos[i]); i++) {
    if (photo.title == title) {
      return photo;
    }
  }
};

Photoset.prototype.upload = function(api, title, filepath, callback) {
  /** upload:

  Like getPhotos, this does not add the resulting Photo to this Photoset,
  but returns it in the callback.

  callback: function(Error | null, Photo | null)
  */
  // logger.debug('Photoset.uploading: %s -> %s', filepath, title);
  var photoset_id = this.id;
  async.auto({
    upload: function(callback, context) {
      api({
        method: 'upload',
        title: title,
        description: 'flickr-sync',
        tags: 'flickr-sync',
        is_public: 0,
        is_friend: 0,
        is_family: 0,
        hidden: 2,
        photo: fs.createReadStream(filepath), // {flags: 'r'} by default
      }, callback);
    },
    addPhoto: ['upload', function(callback, context) {
      api({
        method: 'flickr.photosets.addPhoto',
        photoset_id: photoset_id,
        photo_id: context.upload.photoid._content,
      }, callback);
    }],
    getInfo: ['upload', 'addPhoto', function(callback, context) {
      api({
        method: 'flickr.photos.getInfo',
        photo_id: context.upload.photoid._content,
      }, callback);
    }],
  }, function(err, context) {
    if (err) return callback(err);

    var photo = Photo.fromJSON(context.getInfo.photo);
    callback(err, photo);
  });
};

Photoset.merge = function(api, photosets, callback) {
  /** merge: move all the photos from a list of photosets into one of them and delete the others.

  api: Flickr API request function
  photoset: Array of 2+ Photoset objects
  callback: function(Error | null)

  */
  var primary_photoset = photosets[0];
  // we could pick any photoset, but to make things easier we start with the one that already has the most photos
  photosets.forEach(function(photoset) {
    if (photoset.size > primary_photoset.size) {
      primary_photoset = photoset;
    }
  });

  logger.debug('primary photoset: "%s", ID=%s, (%d photos and videos)',
    primary_photoset.title, primary_photoset.id, primary_photoset.size);

  var other_photosets = photosets.filter(function(photoset) {
    return photoset != primary_photoset;
  });

  async.each(other_photosets, function(photoset, callback) {
    logger.info('merging photoset "%s", ID=%s, (%d photos and videos)',
      photoset.title, photoset.id, photoset.size);

    photoset.getPhotos(api, function(err, photos) {
      if (err) return callback(err);

      async.each(photos, function(photo, callback) {
        api({method: 'flickr.photosets.addPhoto', photoset_id: primary_photoset.id, photo_id: photo.id}, function(err, res) {
          if (err) return callback(err);

          logger.info('addPhoto result: %j', res);

          // now remove it from `photoset`
          api({method: 'flickr.photosets.removePhoto', photoset_id: photoset.id, photo_id: photo.id}, function(err, res) {
            if (err) return callback(err);

            logger.info('removePhoto result: %j', res);

            callback();
          });
        });
      }, function(err) {
        if (err) return callback(err);

        callback();
        // api({method: 'flickr.photosets.delete', photoset_id: photoset.id}, function(err, res) {
        //   if (err) return callback(err);
        //   logger.info('photosets.delete result: %j', res);
        //   callback();
        // });
      });
    });
  }, function(err) {
    if (err) return callback(err);

    // new Error('Debug halt')
    callback();
  });
};
