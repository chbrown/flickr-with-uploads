var http = require('http');
var url = require('url');
var querystring = require('querystring');
var OAuth = require('oauth').OAuth;
var FormData = require('form-data');
var _ = require('underscore');
var xml2js = require('xml2js');


function Flickr(consumer_key, consumer_secret, oauth_token, oauth_token_secret, base_url) {
  this.consumer_key = consumer_key;
  this.consumer_secret = consumer_secret;
  this.oauth_token = oauth_token;
  this.oauth_token_secret = oauth_token_secret;

  this.base_url = base_url || '/services/rest';
  this.oauth_client = new OAuth('http://www.flickr.com/services/oauth/request_token',
    'http://www.flickr.com/services/oauth/access_token', consumer_key, consumer_secret, '1.0A', null, 'HMAC-SHA1');
}
Flickr.prototype.createRequest = function(method, params, signed_in, callback) {
  return new FlickrRequest(this, method, params, signed_in, callback);
};

function FlickrRequest(client, method, params, signed_in, callback) {
  this.client = client;
  this.method = method;
  this.params = params;
  this.signed_in = signed_in;
  this.callback = callback;
}
FlickrRequest.prototype.queryString = function() {
  // easy Object.clone hack
  var params = _.clone(this.params);
  params.format = 'json';
  params.nojsoncallback = '1';
  if (this.signed_in) params.api_key = this.client.consumer_key;
  if (this.method !== 'upload' && this.method !== 'replace')
    params.method = this.method;
  else
    delete params.photo;
  return '?' + querystring.stringify(params);
};
FlickrRequest.prototype.send = function() {
  if (this.method === 'upload' || this.method === 'replace')
    this.sendPOST();
  else
    this.sendGET();
};
FlickrRequest.prototype.sendGET = function() {
  var self = this,
    api_url = 'http://api.flickr.com' + this.client.base_url + this.queryString();

  if (this.signed_in)
    api_url = this.client.oauth_client.signUrl(api_url, this.client.oauth_token, this.client.oauth_token_secret);

  var api_url_parts = url.parse(api_url);

  var payload = {host: api_url_parts.host, path: api_url_parts.path};
  var req = http.request(payload, function(res) { self.handleResponseStream(res); });
  req.end();
};
FlickrRequest.prototype.sendPOST = function() {
  var self = this,
    api_url = this.client.oauth_client.signUrl('http://api.flickr.com/services/'+ this.method+'/' + this.queryString(),
      this.client.oauth_token, this.client.oauth_token_secret, 'POST'),
    api_url_parts = url.parse(api_url),
    querystring_parts = querystring.parse(api_url_parts.query),
    form = new FormData();

  for (var key in querystring_parts) {
    form.append(key, querystring_parts[key]);
  }
  form.append('photo', this.params.photo);

  var payload = {host: api_url_parts.host, path: '/services/'+ this.method+'/?format=json', headers: form.getHeaders(), method: 'POST'};
  var req = http.request(payload, function(res) { self.handleResponseStream(res); });
  form.pipe(req);
};

FlickrRequest.prototype.handleResponseStream = function(response) {
  var self = this, data = '';
  response.setEncoding('utf8');
  response.on('data', function (chunk) {
    data += chunk;
  });
  response.on('end', function () {
    self.processResponse(data);
  });
};
FlickrRequest.prototype.processResponse = function(response_body) {
  var self = this;
  if (response_body.match(/^\s*<\?xml/)) {
    xml2js.parseString(response_body, function(err, result) {
      result = !err && _.omit(_.extend(result.rsp, result.rsp.$), '$');
      handleRes(err, result);
    });
  } else if (response_body) {
    // Bizarrely Flickr seems to send back invalid JSON (it escapes single quotes in certain circumstances?!?!!?)
    // We fix that here. <- Sujal
    response_body = response_body.replace(/\\'/g,"'");
    var err, res;
    try {
      res = JSON.parse(response_body);
    } catch (exc) {
      err = exc.toString();
    }
    handleRes(err, res);
  } else {
    handleRes(null, {});
  }

  function handleRes(err, res) {
    if (res.stat === 'ok') {
      self.callback(null, res);
    } else {
      var error = 'flickr-with-uploads error.';
      if (res && res.code && res.message)
        error += ' ' + res.code + ': ' + res.message;
      else if (res && res.error)
        error += ' ' + res.error;
      self.callback(new Error(error));
    }
  }
};

exports.Flickr = Flickr;
