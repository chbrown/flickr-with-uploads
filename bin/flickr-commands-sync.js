'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var path = require('path');
var streaming = require('streaming');

var logger = require('../lib/logger');
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

module.exports = function(api, optimist) {
  var argv = optimist.demand(['directory']).argv;
  var user = new orm.User(api);

  var uploadLocalPhoto = function(local_photo, callback) {
    // local_photo has .name, .album, and .filepath properties
    // Function: findOrCreatePhoto(photo_title, photoset_title, filepath, callback)
    user.findOrCreatePhoto(local_photo.name, local_photo.album, local_photo.filepath, function(err) {
      if (err) {
        throw err;
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
      else {
        logger.info('Uploaded "%s" to "%s"', local_photo.name, local_photo.album);
      }

      callback();
    });
  };

  // 1. walk over the files in the specified directory
  // var glob_pattern = '*/*.{gif,png,jpg,jpeg,tif,tiff,avi,mp4,mov,flv}';
  var walk_stream = new streaming.Walk(argv.directory)
  .on('error', function(err) {
    logger.error('Error with streaming.Walk: %s', err);
    process.exit(1);
  })
  .on('end', function() {
    logger.debug('Finished walking all files.');
  });

  // 2. filter out directories and hidden files
  var file_stream = new streaming.Filter(function(node) {
    var basename = path.basename(node.path);
    return node.stats.isFile() && basename[0] != '.';
  })
  .on('error', function(err) {
    logger.error('Error with streaming.Filter: %s', err);
    process.exit(1);
  })
  .on('end', function() {
    logger.debug('Finished filtering all files.');
  });
  walk_stream.pipe(file_stream);

  // 3. read each file, splitting it into album name, photo name, and full filepath
  var local_photo_stream = new streaming.Mapper(function(node) {
    // node.path, e.g.: '/etc/some/directory/album/photo/'
    var photo = path.basename(node.path);
    var album = path.basename(path.dirname(node.path));
    return new LocalPhoto(album, photo, node.path);
  })
  .on('error', function(err) {
    logger.error('Error with streaming.Mapper: %s', err);
    process.exit(1);
  })
  .on('end', function() {
    logger.info('Finished mapping all files.');
  });
  file_stream.pipe(local_photo_stream);

  // 4. add each local_photo to a limited queue
  logger.debug('Using %d workers.', argv.workers);
  var queue_stream = new streaming.Queue(argv.workers, uploadLocalPhoto)
  .on('error', function(err) {
    logger.error('Error with streaming.Queue: %s', err);
    process.exit(1);
  })
  .on('end', function() {
    logger.info('Finished uploading all local photos.');
  });
  local_photo_stream.pipe(queue_stream);
};
