'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var fs = require('fs');
var logger = require('../lib/logger');
var util = require('util');
var events = require('events');

var Photo = module.exports = function(id, title, is_public, is_friend, is_family, filepath) {
  events.EventEmitter.call(this);

  // basics
  this.id = id;
  this.title = title;

  // permissions
  this.is_public = is_public;
  this.is_friend = is_friend;
  this.is_family = is_family;

  // local
  this.filepath = filepath;

  // meta
  this._ready_pending = false;
};
util.inherits(Photo, events.EventEmitter);

Photo.fromJSON = function(obj) {
  /** Photo.fromJSON({id: '12...90', ...})

  A raw Photo returned by 'flickr.photosets.getPhotos':

    {
      "id": "1721812774",
      "secret": "9b0b2ef6ea",
      "server": "1299",
      "farm": 1,
      "title": "IMG_3171.JPG",
      "isprimary": "0"
    }

  So it's a pretty straightforward translation from raw to model, compared to the Photoset.fromJSON method.
  */
  // logger.debug('Photo.fromJSON: %j', obj);
  return new Photo(obj.id, obj.title, obj.ispublic, obj.isfriend, obj.isfamily);
};

Photo.prototype.ready = function(callback) {
  /** .ready() uploads this photo to Flickr from the local filesystem.

  Requires that:
  * `this.api` is an API request function
  * `this.title` is a String
  * `this.filepath` is a String that refers to a file on the local filesystem

  callback: function(Error | null)
  */
  var self = this;
  if (this.id) {
    // we're all ready to go! force async for the sake of consistency
    setImmediate(callback);
  }
  else {
    this.on('ready', callback);

    // only need to get ready once:
    if (!this._ready_pending) {
      this._ready_pending = true;

      var now_string = new Date().toISOString().replace('T', ' ').split('.')[0];
      this.api({
        method: 'upload',
        title: this.title,
        description: 'Uploaded via flickr sync on ' + now_string,
        tags: 'sync',
        is_public: 0,
        is_friend: 0,
        is_family: 0,
        hidden: 2,
        photo: fs.createReadStream(this.filepath), // {flags: 'r'} by default
      }, function(err, res) {
        if (err) return callback(err);

        logger.debug('Upload result: %j', res);
        self.api({
          method: 'flickr.photos.getInfo',
          photo_id: res.photoid._content,
        }, function(err, res) {
          if (err) return callback(err);

          callback();
        });
      });
    }
  }
};
