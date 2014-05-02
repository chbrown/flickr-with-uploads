/*jslint node: true */
var util = require('util');
var events = require('events');
var async = require('async');
var logger = require('loge');

var Photo = require('./photo');

var Photoset = module.exports = function(id, title, description, primary_photo, size) {
  events.EventEmitter.call(this);
  this.setMaxListeners(500);

  // the Flickr-assigned ID (maybe null)
  this.id = id;
  // the title value or folder name if the photoset is new
  this.title = title;
  // description, if any
  this.description = description;
  // primary
  this.primary_photo = primary_photo;
  // the number of photos + videos, if any
  this.size = size;

  // local stateful things
  this._photos = {};
  // api request function to fill in later if required
  this.api = null;
  // this._ready is somewhat equivalent to (this.id && this._photos != {})
  this._ready = false;
  this.on('ready', function() { this._ready = true; }.bind(this));
  // this._ready_pending is set to true once the initialization process is started
  // (since it only needs to be readied once)
  this._ready_pending = false;
};
util.inherits(Photoset, events.EventEmitter);

Photoset.fromJSON = function(obj) {
  /** Photoset.fromJSON({id: '73...10', ...})

  A raw Photoset might look like this:

      {
        "$": {
          "id": "73805723521590545",
          "primary": "3035683619",
          "secret": "52bfc8d1d0",
          "server": "1350",
          "farm": 1,
          "photos": "184",
          "videos": 0,
          "needs_interstitial": 0,
          "visibility_can_see_set": 1,
          "count_views": "14",
          "count_comments": "0",
          "can_comment": 1,
          "date_create": "1102975059",
          "date_update": "1323337004"
        },
        "title": [
          "Breakdance pants"
        ],
        "description": [
          ""
        ]
      }

  */
  var size = parseInt(obj.$.photos, 10) + parseInt(obj.$.videos, 10);
  return new Photoset(obj.$.id, obj.title[0], obj.description[0], obj.$.primary, size);
};

Photoset.prototype.ready = function(callback) {
  /** Ensure that the photoset exists on Flickr, and that we have fetched info about all its photos.

  If there is no available id, persist this photoset to Flickr and get an id.

  This fills `this._photos`

  Consistently asynchronous.

  callback: function(Error | null)
  */
  if (this._ready) {
    // we're all ready to go! force async for the sake of consistency
    setImmediate(callback);
  }
  else {
    this.on('ready', callback);

    // only need to get ready once:
    if (!this._ready_pending) {
      this._ready_pending = true;

      var self = this;
      if (this.id) {
        this.getPhotos(function(err, photos) {
          if (err) return callback(err);

          photos.forEach(function(photo) {
            self._photos[photo.title] = photo;
          });

          self.emit('ready');
        });
      }
      else {
        // Create a new photoset with this's properties
        logger.debug('Creating photoset, "%s"', this.title);
        this.api({
          method: 'flickr.photosets.create',
          title: this.title,
          description: this.description,
          primary_photo_id: this.primary_photo.id,
        }, function(err, res) {
          if (err) return callback(err);

          self.id = res.photoset.id;
          self.emit('ready');
        });
      }
    }
  }
};

Photoset.prototype.getPhotos = function(callback) {
  /** Page through all available photos, assuming the photoset exists.

  This method is called and processed from .ready()

  This method does not store the photos returned in the callback.

  Requires that:
  * `this.api` is an API request function
  * `this.id` is a valid Photoset ID

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
      self.api({method: 'flickr.photosets.getPhotos', photoset_id: self.id, page: page_index}, function(err, res) {
        if (err) return callback(err);

        page_count = res.photoset.pages;

        // res.photoset.photo is an array of raw photo json objects
        // logger.debug('Got page: %j', res.photoset.photo, res.photoset.photo.map);
        var page_photos = res.photoset[0].photo.map(Photo.fromJSON);
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

Photoset.prototype.addPhoto = function(photo, callback) {
  /** .addPhoto(photo) adds an existing Flickr photo to an existing Flickr photoset.

  Requires that:
  * `this.api` is an API request function
  * `this.id` is a String

  callback: function(Error | null)
  */
  var self = this;
  this.api({
    method: 'flickr.photosets.addPhoto',
    photoset_id: this.id,
    photo_id: photo.id,
  }, function(err, res) {
    if (err) return callback(err);

    // and record it locally
    self._photos[photo.title] = photo;

    // logger.debug('photoset.addPhoto result: %j', res);
    callback();
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

    photoset.api = api;
    photoset.getPhotos(function(err, photos) {
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
