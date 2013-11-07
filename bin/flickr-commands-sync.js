'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
// var fs = require('fs');
var path = require('path');
// var async = require('async');

var logger = require('../lib/logger');
// var response = require('../lib/response');
var streaming = require('streaming');

var orm = require('../orm');

var LocalPhoto = function(album, name, filepath) {
  /** create a representation of a photo that exists on the local filesystem.
    album: The name of the photoset to upload this photo to (the parent directory's name)
    name: The title to use for this photo (the filename)
    filepath: The fully-specified location of the photo on the local filesystem
  */
  this.album = album;
  this.name = name;
  this.filepath = filepath;
};

module.exports = function(request, optimist) {
  var argv = optimist.demand(['directory']).argv;

  var user = new orm.User(request);

  var uploadLocalPhoto = function(local_photo, callback) {
    // logger.info('Uploading local photo: %j', local_photo);
    // flickr_database.getPhotoset checks the local cache and hits the Flickr API as needed.
    //   as per the streaming.Queue API, this must ALWAYS be truly async.
    user.getPhotoset(local_photo.album, function(err, photoset) {
      if (err) {
        logger.error('Error with getPhotoset("%s", ...) error: %j', local_photo.album, err);
        return callback(err);
      }

      var photo = photoset.findPhoto(local_photo.name);
      if (photo) {
        logger.info('"%s" already exists in "%s"', local_photo.name, photoset.title);
        callback();
      }
      else {
        logger.debug('Uploading "%s" to "%s"', local_photo.name, photoset.title);
        // logger.debug('Did not find photo named "%s" in photoset "%s", uploading.',
        //   local_photo.name, local_photo.album);
        photoset.upload(user.api, local_photo.name, local_photo.filepath, function(err) {
          if (err) {
            logger.error('Failed to upload photo "%s" to photoset "%s"',
              local_photo.name, local_photo.album, err);
            // write local photo back to the end of the queue stream?
            // need to support reopening a streaming.Queue
            // queue_stream.write(local_photo);
            logger.warn('Retrying immediately (warning: may induce infinite loop)');
            return setImmediate(function() {
              uploadLocalPhoto(local_photo, callback);
            });
          }

          logger.info('Uploaded "%s" to "%s"', local_photo.name, local_photo.album);
          callback();
        });
      }
    });
  };

  user.getCoverPhoto(function(err, cover_photo) {
    if (err) return logger.error(err);
    user.cover_photo = cover_photo;

    user.getPhotosets(function(err, photosets) {
      if (err) return logger.error(err);
      user.photosets = photosets;

      // okay, everything's fetched, we're ready

      // 1. walk over the files in the specified directory
      var glob_pattern = '*/*.{gif,png,jpg,jpeg,tif,tiff,avi,mp4,mov,flv}';
      var glob_stream = new streaming.Glob(glob_pattern, {cwd: argv.directory, nocase: true})
      .on('error', function(err) {
        logger.error('Error with streaming.Glob: %j', err);
        process.exit(1);
      })
      .on('end', function() {
        logger.debug('Globbed all files from subfolders.');
      });

      // 2. read each file, splitting it into album name, photo name, and full filepath
      var photo_stream = new streaming.Mapper(function(match) {
        var album = path.dirname(match);
        var photo = path.basename(match);
        return new LocalPhoto(album, photo, path.join(argv.directory, match));
      })
      .on('error', function(err) {
        logger.error('Error with streaming.Mapper: %j', err);
        process.exit(1);
      })
      .on('end', function() {
        logger.info('Added photos to the queue.');
      });

      // 3. add each local_photo to a limited queue
      var queue_stream = new streaming.Queue(argv.workers, uploadLocalPhoto)
      .on('error', function(err) {
        logger.error('Error with streaming.Queue: %j', err);
        process.exit(1);
      })
      .on('end', function() {
        logger.info('Finished. Upload queue is drained; all photos have been processed');
      });

      // kick it off!
      glob_stream.pipe(photo_stream).pipe(queue_stream);
    });
  });
};
