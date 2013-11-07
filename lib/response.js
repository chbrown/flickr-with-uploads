'use strict'; /*jslint es5: true, node: true, indent: 2 */ /* globals setImmediate */
var sax = require('sax');
var logger = require('./logger');

var select = exports.select = function(object, path) {
  if (path) {
    var props = path.split('.');
    for (var i = 0, prop; (prop = props[i]); i++) {
      object = object[prop];
    }
  }
  return object;
};

var xml2js = exports.xml2js = function(xml, callback) {
  /** xml2js: convert an xml string to a plain (although non-idiomatic) javascript object

  xml: String
  callback: function(Error | null, Object | null)
  */
  var obj = {};
  var stack = [];
  // try {
  var parser = sax.createStream(true, {trim: true})
  .on('error', function(err) {
    // sax has this weird quirk where you have to throw the error to make it quit parsing.
    // I.e., there's no other way to get it to stop, as far as I can tell.
    // throw err;
    logger.error('SAX XML Error: %s', err);
    parser.end();
    callback(err);
  })
  .on('text', function(text) {
    if (stack.length) {
      stack[stack.length - 1]._content = (stack[stack.length - 1]._content || '') + text;
    }
  })
  .on('opentag', function(node) {
    stack.push(node.attributes);
  })
  .on('closetag', function(node) {
    obj[node] = stack.pop();
  })
  .on('end', function() {
    callback(null, obj);
  });

  parser.end(xml);
  // }
  // catch (sax_exception) {
  //   callback(sax_exception);
  // }
};

function tryJSON(string) {
  try {
    return JSON.parse(string);
  }
  catch (exception) {
    return exception;
  }
}

var coalesce = exports.coalesce = function(body, callback) {
  /** coalesce: convert a Flickr API response string into a consolidated, consistent javascript object.

  Flickr doesn't always respond with JSON.
    1. It returns a querystring when there are (OAuth) errors.
    2. It returns xml for 'upload' and 'replace' requests.

  For example, an async upload response:

      <?xml version="1.0" encoding="utf-8" ?>
      <rsp stat="ok">\n<ticketid>8412916-19001238788141232</ticketid>\n</rsp>

  or a normal upload:

      <photoid>1234</photoid>

  or a replace:

      <photoid secret="abcdef" originalsecret="abcdef">1234</photoid>

  callback signature: function(err, response_object)
  */
  var result = tryJSON(body);
  if (result instanceof Error) {
    // logger.error('Coalesce JSON.parse error:', result); // totally normal, don't sweat it.
    xml2js(body, function(err, doc) {
      callback(err, doc);
    });
  }
  else {
    setImmediate(function() {
      callback(null, result);
    });
  }
};
