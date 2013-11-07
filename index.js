'use strict'; /*jslint es5: true, node: true, indent: 2 */
var oauth = require('oauth');
var streaming = require('streaming');

var logger = require('./lib/logger');
var request = require('./lib/request');
var response = require('./lib/response');

// requestFactory uses these urls, but this hash is also attached to the requestFactory
// so that the user can change them if needed.
var oauth_endpoints = {
  request: 'http://www.flickr.com/services/oauth/request_token',
  authorize: 'http://www.flickr.com/services/oauth/authorize',
  access: 'http://www.flickr.com/services/oauth/access_token',
};

var requestFactory = function(consumer_key, consumer_secret, oauth_token, oauth_token_secret) {
  /** set up a request factory, creating a closure of variables so that we can
  create multiple requests without unncessary re-initialization. */
  var oauth_client = new oauth.OAuth(
    oauth_endpoints.request, oauth_endpoints.access,
    consumer_key, consumer_secret, '1.0A', null, 'HMAC-SHA1');
  return function(opts, callback) {
    // callback signature: function(err, response_object)
    opts.api_key = consumer_key;
    // logger.debug('Flickr API: %j', opts);
    request(opts, oauth_client, oauth_token, oauth_token_secret, function(err, res) {
      if (err) return callback(err);

      res.setEncoding('utf8');
      streaming.readToEnd(res, function(err, chunks) {
        if (err) return callback(err);

        // coalesce handles the varying response format the Flickr API may decide to send
        response.coalesce(chunks.join(''), callback);
      });
    });
  };
};

requestFactory.oauth_endpoints = oauth_endpoints;
module.exports = requestFactory;
