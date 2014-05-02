/*jslint node: true */
var fs = require('fs');

exports.readFile = function(filepath, callback) {
  /** Read object from the specified (JSON formatted) file and callback with an object.

  callback: function(Error | null, Object | null)
  */
  var expanded_filepath = filepath.replace(/^~/, process.env.HOME);
  fs.readFile(expanded_filepath, {encoding: 'utf8'}, function(err, data) {
    if (err) return callback(err);
    try {
      callback(null, JSON.parse(data));
    }
    catch (exc) {
      callback(exc);
    }
  });
};

exports.parse = function(json_string) {
  try {
    return JSON.parse(json_string);
  }
  catch (exception) {
    return exception;
  }
};

exports.parseAsync = function(json_string, callback) {
  try {
    var result = JSON.parse(json_string);
    setImmediate(function() {
      callback(null, result);
    });
  }
  catch (exception) {
    setImmediate(function() {
      callback(exception);
    });
  }
};
