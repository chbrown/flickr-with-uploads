'use strict'; /*jslint es5: true, node: true, indent: 2 */
var logger = require('../lib/logger');

var Photo = module.exports = function(id, title, isprimary, is_public, is_friend, is_family) {
  // basics
  this.id = id;
  this.title = title;
  this.isprimary = isprimary;
  // permissions
  this.is_public = is_public;
  this.is_friend = is_friend;
  this.is_family = is_family;
};

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
  return new Photo(obj.id, obj.title, obj.isprimary, obj.ispublic, obj.isfriend, obj.isfamily);
};
