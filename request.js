/*jslint node: true */
var _ = require('lodash');
var FormData = require('form-data');
var https = require('https');
var logger = require('loge');
var url = require('url');

var requestOptions = function(opts) {
  // method is the Flickr API method name
  if (opts.method == 'upload') {
    // http://up.flickr.com/services/upload/
    return {
      method: 'POST',
      protocol: 'https',
      hostname: 'up.flickr.com',
      pathname: '/services/upload/',
      query: _.omit(opts, 'method'),
    };
  }
  else if (opts.method == 'replace') {
    return {
      method: 'POST',
      protocol: 'https',
      hostname: 'up.flickr.com',
      pathname: '/services/replace/',
      query: _.omit(opts, 'method'),
    };
  }
  else {
    return {
      method: 'GET',
      protocol: 'https',
      hostname: 'api.flickr.com',
      pathname: '/services/rest/',
      query: opts,
    };
  }
};

var send = function(opts, oauth_client, oauth_token, oauth_token_secret, callback) {
  /**
    `opts` is a object of parameters, generally with strings values,
      or perhaps a readable stream. There are two required keys:
    `opts.method` is the simple name of the Flickr API call
    `opts.api_key` is the oauth consumer key

    If `opts.photo` is set and `opts.method` is "upload" or "replace",
      `opts.photo` is assumed to be a readable stream, will be detached for
      signing purposes, and then reattached to the POST request.

    oauth_client: oauth.OAuth, client object (primed with consumer (app) key and secret, and relevant urls)
    oauth_token: String, user's access token
    oauth_token_secret: String, user's secret token
    callback: function(Error | null, Object)
  */

  var photo = opts.photo;
  delete opts.photo;

  // method and api_key come from opts, and they go into the querystring
  // representation of the url, which gets signed via OAuth
  var request_options = requestOptions(opts);

  var urlStr = url.format(request_options);
  // logger.error('urlStr::' + urlStr, oauth_token, oauth_token_secret, request_options.method);
  var signed_urlStr = oauth_client.signUrl(urlStr, oauth_token, oauth_token_secret, request_options.method);
  var signed_request_options = url.parse(signed_urlStr, true);
  // logger.error('signed_request_options', signed_request_options);

  if (request_options.method == 'POST') {
    var form = new FormData();
    _.each(signed_request_options.query, function(value, key) {
      form.append(key, value);
    });
    if (photo) {
      form.append('photo', photo);
    }

    form.getLength(function(err, length) {
      if (err) return callback(err);

      var post_request_options = {
        hostname: request_options.hostname,
        method: request_options.method,
        path: request_options.pathname,
        headers: {
          'content-length': length,
          'content-type': 'multipart/form-data; boundary=' + form.getBoundary(),
        },
      };
      var post_req = https.request(post_request_options);

      // logger.debug('POST request_opts: %j', post_request_options, form);
      form.pipe(post_req);
      callback(null, post_req);
    });
  }
  else {
    // logger.debug('GET request_opts: %j', request_options);
    var get_req = https.request(signed_request_options);
    get_req.end();
    callback(null, get_req);
  }
};

module.exports = function(opts, oauth_client, oauth_token, oauth_token_secret, callback) {
  send(opts, oauth_client, oauth_token, oauth_token_secret, function(err, req) {
    if (err) return callback(err);

    req.on('response', function(res) {
      callback(null, res);
    })
    .on('error', function(err) {
      req.destroy();
      callback(err);
    })
    .on('timeout', function() {
      req.destroy();
      callback(new Error('Timeout error'));
    })
    .setTimeout(30000);
  });
};
