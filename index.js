/*jslint node: true */
var oauth = require('oauth');
var streaming = require('streaming');
var logger = require('loge');
var xml2js = require('xml2js');

var json = require('./json');
var request = require('./request');
// var response = require('./response');

// requestFactory uses these urls, but this hash is also attached to the requestFactory
// so that the user can change them if needed.
var oauth_endpoints = {
  request: 'https://www.flickr.com/services/oauth/request_token',
  authorize: 'https://www.flickr.com/services/oauth/authorize',
  access: 'https://www.flickr.com/services/oauth/access_token',
};

var parseResponse = function(res, callback) {
  /** parseResponse: coalesce a Flickr API response string into a consolidated, consistent javascript object.

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
  res.setEncoding('utf8');
  streaming.readToEnd(res, function(err, chunks) {
    if (err) return callback(err);

    var body = chunks.join('');
    // logger.debug('response res.headers', res.headers);

    if (res.headers['content-type'].match(/text\/xml/)) {
      xml2js.parseString(body, {explicitRoot: false, explicitArray: true}, function(err, doc) {
        callback(err, doc);
      });
    }
    else if (res.headers['content-type'].match(/application\/json/)) {
      json.parseAsync(body, callback);
    }
    else {
      setImmediate(function() {
        callback(new Error('Invalid response format. ' + body));
      });
    }
  });
};

var requestFactory = function(consumer_key, consumer_secret, oauth_token, oauth_token_secret) {
  /** set up a request factory, creating a closure of variables so that we can
  create multiple requests without unncessary re-initialization. */
  var oauth_client = new oauth.OAuth(
    oauth_endpoints.request, oauth_endpoints.access,
    consumer_key, consumer_secret, '1.0', null, 'HMAC-SHA1');
  return function(opts, callback) {
    // callback signature: function(err, response_object)
    // opts.api_key = consumer_key;
    // logger.debug('Flickr API: %j', opts);
    request(opts, oauth_client, oauth_token, oauth_token_secret, function(err, res) {
      if (err) return callback(err);

      // parseResponse handles the varying response format the Flickr API may decide to send
      parseResponse(res, function(err, result) {
        if (err) return callback(err);

        // var resStr = util.inspect(res, {showHidden: true, depth: 5});
        // logger.debug('Flickr request: %j; Flickr response: %j', opts, result);

        if (result.$.stat != 'ok') {
          var custom_err = new Error('stat != ok in Flickr API response');
          logger.debug('Flickr failure response: %j', result, res.headers);
          return callback(custom_err);
        }

        callback(null, result);
      });
    });
  };
};

requestFactory.fromFilepath = function(credentials_filepath, callback) {
  /** Create Flickr client from the credentials stored (in JSON format) in the specified filepath.
  Returns client request closure */
  json.readFile(credentials_filepath, function(err, credentials) {
    if (err) return callback(err);
    var request = requestFactory(
      credentials.consumer_key,
      credentials.consumer_secret,
      credentials.oauth_token,
      credentials.oauth_token_secret);
    callback(null, request);
  });
};

requestFactory.oauth_endpoints = oauth_endpoints;
module.exports = requestFactory;
