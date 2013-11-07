'use strict'; /*jslint es5: true, node: true, indent: 2 */
var url = require('url');
var http = require('http');

var FormData = require('form-data');

var request = module.exports = function(opts, oauth_client, oauth_token, oauth_token_secret, callback) {
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
  var urlObj = {
    protocol: 'http',
    hostname: 'ycpi.api.flickr.com',
    pathname: '/services/rest/'
  };
  var http_method = 'GET';

  if (opts.method == 'upload') {
    urlObj.hostname = 'up.flickr.com';
    // http://up.flickr.com/services/upload/
    urlObj.pathname = '/services/upload/';
    http_method = 'POST';
  }
  else if (opts.method == 'replace') {
    urlObj.pathname = '/services/replace/';
    http_method = 'POST';
  }

  var photo = opts.photo;
  delete opts.photo;

  urlObj.query = {
    format: 'json',
    nojsoncallback: '1',
  };
  // method and api_key come from opts
  for (var k in opts) {
    urlObj.query[k] = opts[k];
  }

  var urlStr = url.format(urlObj);
  var signed_urlStr = oauth_client.signUrl(urlStr, oauth_token, oauth_token_secret, http_method);
  var request_opts = url.parse(signed_urlStr, true);
  request_opts.method = http_method;

  if (http_method == 'POST') {
    var form = new FormData();
    // get the querystring-less version of the path
    request_opts.path = request_opts.pathname;
    for (var query_key in request_opts.query) {
      form.append(query_key, request_opts.query[query_key]);
    }
    if (photo) {
      form.append('photo', photo);
    }

    // Thanks to @neojski for this snippet
    //   https://github.com/chbrown/flickr-with-uploads/issues/5
    form.submit(request_opts, callback);
  }
  else {
    http.get(request_opts, function(res) {
      callback(null, res);
    }).on('error', callback);
  }
};
