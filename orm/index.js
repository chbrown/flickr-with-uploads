'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('winston');
var _ = require('underscore');
var stream = require('stream');

var FlickrPhoto = exports.FlickrPhoto = function(attributes) {
  _.extend(this, attributes);
};
FlickrPhoto.fromJSON = function(obj) {
  return new FlickrPhoto({
    id: obj.id,
    title: obj.title,
    is_public: obj.ispublic,
    is_friend: obj.isfriend,
    is_family: obj.isfamily,
  });
};

var FlickrUser = exports.FlickrUser = function(api) {
  /**
    api: initialized Flickr client request function
  */
  this.api = api;
  // this.cover_photo = Object<FlickrPhoto> with 'id' property to use for future uploads
  this.cover_photo = null;
  // this.photosets = { photoset_title: Object<FlickrPhotoset>, ...}
  // however, those flickr photosets may not be initialized
  this.photosets = null;
};
FlickrUser.prototype.initialize = function(callback) {
  // callback signature: function(err)
  // before this runs, FlickrUser.photosets == null
  // after this runs, FlickrUser.photosets will be at least {}
  var self = this;
  this.photosets = {};
  async.auto({
    coverPhoto: function(callback, context) {
      // get the backup-cover-photo (Flickr requires photosets to have cover photos)
      self.api({
        method: 'flickr.photos.search',
        user_id: 'me',
        tags: 'api'
      }, callback);
    },
    photosetList: function(callback, context) {
      self.api({
        method: 'flickr.photosets.getList',
        per_page: 500
      }, callback);
    },
  }, function(err, context) {
    var first_search_result = context.coverPhoto.photos.photo[0];
    logger.debug('Calling FlickrPhoto.fromJSON: ' + JSON.stringify(first_search_result, null, '  '));
    self.cover_photo = FlickrPhoto.fromJSON(first_search_result);
    logger.debug('Using cover_photo for all backups: %s', self.cover_photo.id);

    context.photosetList.photosets.photoset.forEach(function(photoset_json) {
      var photoset = FlickrPhotoset.fromJSON(self.api, photoset_json);
      // self.photosets is a map: { photoset_title -> FlickrPhotoset object, ... }
      self.photosets[photoset.title] = photoset;
    });
    logger.debug('Found %d photosets.', Object.keys(self.photosets).length);

    callback(err);
  });
};

FlickrUser.prototype.getPhotoset = function(photoset_title, callback) {
  // callback signature: (err, Object<FlickrPhotoset>)
  // this function must be truly async because it's used as a streaming.Queue worker
  var photoset = this.photosets[photoset_title] = this.photosets[photoset_title] || new FlickrPhotoset(this.api, {
    title: photoset_title,
    description: 'flickr-sync',
    primary_photo_id: this.cover_photo.id,
  });

  // ensureCreated() will create the photoset if it did not come from Flickr.
  photoset.ensureCreated(function(err) {
    if (err) {
      callback(err, photoset);
    }
    else {
      photoset.ensureSynced(function(err) {
        callback(err, photoset);
      });
    }
  });
};

var FlickrPhotoset = exports.FlickrPhotoset = function(api, attributes) {
  this.api = api;
  _.extend(this, attributes);

  // this.photos = {photo_title: Object<FlickrPhoto>, ...}
  this.photos = {};
  // this.synced_pages = {1: true, 2: true, 3: false};
  this.synced_pages_last = 1000;
  this.synced_pages = {};
};
FlickrPhotoset.prototype.ensureCreated = function(callback) {
  /** Ensure that the photoset exists on Twitter.

  If there is no available id, persist the photoset described by this'
  properties to Flickr.

  callback signature: function(err)
  */
  if (this.id) {
    // force async even if we don't actually have to
    setImmediate(callback);
  }
  else {
    logger.debug('Creating photoset, "%s"', this.title);
    var self = this;
    this.api({
      method: 'flickr.photosets.create',
      title: this.title,
      description: this.description,
      primary_photo_id: this.primary_photo_id,
    }, function(err, response) {
      if (!err) {
        self.id = response.photoset.id;
      }
      callback(err);
    });
  }
};
FlickrPhotoset.prototype.ensureSynced = function(callback) {
  /** Page through all available photos, assuming the photoset exists,
  caching retrieved photos in this.photos.

  callback signature: function(err)
  */
  var self = this;
  var next = function(err) {
    if (err) {
      callback(err);
    }
    else {
      self.ensureSynced(callback);
    }
  };
  for (var i = 1; i <= this.synced_pages_last; i++) {
    if (this.synced_pages[i] === undefined) {
      return this.getPage(i, next);
    }
  }
  callback();
};
FlickrPhotoset.prototype.getPage = function(page, callback) {
  // callback signature: function(err)
  var self = this;
  logger.debug('FlickrPhotoset.getPage: %d/%d', page, this.synced_pages_last, this.synced_pages);
  this.api({method: 'flickr.photosets.getPhotos', photoset_id: this.id, page: page}, function(err, response) {
    if (!err) {
      self.synced_pages_last = response.photoset.pages;

      // response.photoset.photo is an array of photo_objects
      response.photoset.photo.forEach(function(photo_json) {
        self.photos[photo_json.title] = new FlickrPhoto({
          id: photo_json.id,
          title: photo_json.title,
          isprimary: photo_json.isprimary,
        });
      });

      self.synced_pages[response.photoset.page] = true;
    }
    callback(err);
  });
};
FlickrPhotoset.prototype.upload = function(local_photo, callback) {
  // callback signature: function(err)
  var self = this;
  async.auto({
    upload: function(callback, context) {
      self.api({
        method: 'upload',
        title: local_photo.name,
        description: 'flickr-sync',
        tags: 'flickr-sync',
        is_public: 0,
        is_friend: 0,
        is_family: 0,
        hidden: 2,
        photo: fs.createReadStream(local_photo.filepath), // {flags: 'r'} by default
      }, callback);
    },
    addPhoto: ['upload', function(callback, context) {
      self.api({
        method: 'flickr.photosets.addPhoto',
        photoset_id: self.id,
        photo_id: context.upload.photoid._content,
      }, callback);
    }],
    getInfo: ['upload', 'addPhoto', function(callback, context) {
      self.api({
        method: 'flickr.photos.getInfo',
        photo_id: context.upload.photoid._content,
      }, callback);
    }],
  }, function(err, context) {
    if (!err) {
      var photo = FlickrPhoto.fromJSON(context.getInfo.photo);
      self.photos[photo.title] = photo;
    }
    callback(err);
  });
};
FlickrPhotoset.fromJSON = function(api, obj) {
  logger.debug('Creating FlickrPhotoset from JSON:', JSON.stringify(obj));
  return new FlickrPhotoset(api, {
    id: obj.id,
    title: obj.title._content,
    description: obj.description._content,
    primary_photo_id: obj.primary,
  });
};


var LocalPhoto = exports.LocalPhoto = function(album, name, filepath) {
  /** create a representation of a photo that exists on the local filesystem.
    album: The name of the photoset to upload this photo to (usually the parent directory's name)
    name: The title to use for this photo (usually the filename)
    filepath: The fully-specified location of the photo on the local filesystem
  */
  this.album = album;
  this.name = name;
  this.filepath = filepath;
};
