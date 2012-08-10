var http = require('http'),
  util = require('util'),
  OAuth = require('oauth').OAuth;

function makeQueryString(params) {
  if (Object.keys(params).length) {
    return '?' + params.map(function(key, val) {
        return key + '=' + encodeURIComponent(val);
      }).join('&');
  }
  return '';
}

function Flickr(consumer_key, consumer_secret, options) {
  if (options === undefined) options = {};

  this.consumer_key = consumer_key;
  this.consumer_secret = consumer_secret;
  this.oauth_token = options.oauth_token;
  this.oauth_token_secret = options.oauth_token_secret;

  this.base_url = options.base_url || '/services/rest';
  this.oauth_client = new OAuth('http://www.flickr.com/services/oauth/request_token',
    'http://www.flickr.com/services/oauth/access_token', consumer_key, consumer_secret, '1.0A', null, 'HMAC-SHA1');
}

Flickr.prototype.executeAPIRequest = function (method, params, signed_in, options, callback) {
  // overload as (method, params, signed_in, callback)
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  if (params === undefined) params = {};
  params.format = 'json';
  params.nojsoncallback = '1';
  params.method = method;

  if (signed_in) params.api_key = this.consumer_key;

  var query_string = makeQueryString(params),
    oauth_token = options.oauth_token || this.oauth_token,
    oauth_token_secret = options.oauth_token_secret || this.oauth_token_secret,
    base_url = method === 'upload' ? '/services/upload/' : (options.base_url || this.base_url),
    path = base_url + query_string,
    final_path = path;

  console.log('Pre- sign:', final_path);
  if (signed_in) {
    if (method === 'upload') {
      final_path = this.oauth_client.signUrl('http://api.flickr.com' + path, oauth_token, oauth_token_secret, 'GET');
    }
    else {
      final_path = this.oauth_client.signUrl('http://api.flickr.com' + path, oauth_token, oauth_token_secret, 'GET');
      final_path = final_path.replace(/^http:\/\/api\.flickr\.com/, '');
    }
  }
  console.log('Post-sign:', final_path);

  var req = http.request({host: 'api.flickr.com', path: path, method: options.method || 'GET'}).on('response', function(res) {
    var data = '';
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      data += chunk;
    });
    res.on('end', function () {
      self.processResponse(data, options, callback);
    });
  });
  if (method === 'upload') {
    req.pipe(params.file);
  }
  else {
    req.end();
  }
};


Flickr.prototype.processResponse = function(response_body, options, callback) {
  if (options === undefined) options = {};

  var result_mapper = options.result_mapper;

  // comment from Flickrnode:
  // Bizarrely Flickr seems to send back invalid JSON (it escapes single quotes in certain circumstances?!?!!?)
  // We fix that here.
  if (response_body) {
    response_body = response_body.replace(/\\'/g,"'");
  }

  var res = JSON.parse(response_body);
  if (res.stat && res.stat == 'ok') {
    if (result_mapper ) {
      res = result_mapper(res);
    }
    callback(null, res);
  }
  else {
    callback(new Error('Flickr Error (' + res.code + '): ' + res.message));
  }
};

exports.Flickr = Flickr;