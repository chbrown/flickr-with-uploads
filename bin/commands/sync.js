/*jslint node: true */
var path = require('path');
var streaming = require('streaming');
var async = require('async');
var logger = require('loge');
var flickr = require('../..');
var orm = require('../../orm');


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

module.exports = function(optimist) {
  var argv = optimist.demand(['directory']).argv;

  // 1. walk over the files in the specified directory
  //    emitted data are {path: String, stats: fs.Stats} objects
  var walk_stream = new streaming.Walk(argv.directory);
  // .on('error', function(err) {
  //   logger.error('Error with streaming.Walk: %s', err);
  //   process.exit(1);
  // })
  // .on('end', function() {
  //   logger.debug('Finished walking all files.');
  // });

  // 2. filter out directories and hidden files and files that are too big (over 1GB)
  //    as well as raw files
  var file_type_regex = /(gif|png|jpg|jpeg|tif|tiff|avi|mp4|mov|flv)$/i;
  var file_stream = new streaming.Filter(function(node) {
    var basename = path.basename(node.path);

    return node.stats.isFile() && basename[0] != '.' && node.stats.size < 1e9 && basename.match(file_type_regex);
  });
  // .on('error', function(err) {
  //   logger.error('Error with streaming.Filter: %s', err);
  //   process.exit(1);
  // })
  // .on('end', function() {
  //   logger.debug('Finished filtering all files.');
  // });

  // 3. read each file, splitting it into album name, photo name, and full filepath
  var local_photo_stream = new streaming.Mapper(function(node) {
    // node.path, e.g.: '/etc/some/directory/album/photo/'
    var photo = path.basename(node.path);
    var album = path.basename(path.dirname(node.path));
    return new LocalPhoto(album, photo, node.path);
  });
  // .on('error', function(err) {
  //   logger.error('Error with streaming.Mapper: %s', err);
  //   process.exit(1);
  // })
  // .on('end', function() {
  //   logger.info('Finished mapping all files.');
  // });

  // 4. add each local_photo to a limited queue
  logger.debug('Using %d workers.', argv.workers);

  // .on('error', function(err) {
  //   logger.error('Error with streaming.Queue: %s', err);
  //   process.exit(1);
  // })
  // .on('end', function() {
  //   logger.info('Finished uploading all local photos.');
  // });

  flickr.fromFilepath(argv.credentials, function(err, request) {
    if (err) return logger.error(err);

    var user = new orm.User(request);

    var uploadLocalPhoto = function(local_photo, callback) {
      // local_photo has .name, .album, and .filepath properties
      // Function: findOrCreatePhoto(photo_title, photoset_title, filepath, callback)
      user.findOrCreatePhoto(local_photo.name, local_photo.album, local_photo.filepath, function(err) {
        if (err) {
          logger.error('Failed to upload photo "%s" to photoset "%s"',
            local_photo.name, local_photo.album, err.stack);
          // write local photo back to the end of the queue stream?
          // need to support reopening a streaming.Queue
          logger.warn('Adding to end of queue');
          queue_stream.write(local_photo);
          // logger.warn('Retrying immediately (warning: may induce infinite loop)');
          // return setImmediate(function() {
          //   uploadLocalPhoto(local_photo, callback);
          // });
        }
        // else {
          // logger.info('Uploaded "%s" to "%s"', local_photo.name, local_photo.album);
        // }

        callback();
      });
    };

    var queue_stream = new streaming.Queue(argv.workers, uploadLocalPhoto);
    walk_stream.pipe(file_stream).pipe(local_photo_stream).pipe(queue_stream, {end: false});
  });
};
