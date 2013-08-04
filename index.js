'use strict'; /*jslint es5: true, node: true, indent: 2 */
var http = require('http');
var url = require('url');
var oauth = require('oauth');
var FormData = require('form-data');
var sax = require('sax');

function readToEnd(readable_stream, callback) {
  var content = '';
  readable_stream.setEncoding('utf8');
  readable_stream.on('data', function (chunk) {
    content += chunk;
  });
  readable_stream.on('error', function (err) {
    callback(err, content);
  });
  readable_stream.on('end', function () {
    callback(null, content);
  });
}

// requestFactory uses these urls, but this hash is also attached to the requestFactory
// so that the user can change them if needed.
var oauth_endpoints = {
  request: 'http://www.flickr.com/services/oauth/request_token',
  authorize: 'http://www.flickr.com/services/oauth/authorize',
  access: 'http://www.flickr.com/services/oauth/access_token',
};

function request(opts, oauth, oauth_token, oauth_token_secret, callback) {
  /**
    `opts` is a object of parameters, generally with strings values,
      or perhaps a readable stream. There are two required keys:
    `opts.method` is the simple name of the Flickr API call
    `opts.api_key` is the oauth consumer key

    if `opts.photo` is set and `opts.method` is "upload" or "replace",
      it is assumed to be a readable stream, will be detached for signing purposes,
      and then reattached to the POST request.

    callback signature: function(err, response)
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
  for (var opt_key in opts) {
    urlObj.query[opt_key] = opts[opt_key];
  }

  var urlStr = url.format(urlObj);
  var signed_urlStr = oauth.signUrl(urlStr, oauth_token, oauth_token_secret, http_method);
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
}

function xml2js(xml, callback) {
  // callback signature: function(err, object).
  var obj = {};
  var stack = [];
  // sax has this weird quirk where you have to throw the error to make it quit parsing.
  try {
    var parser = sax.createStream(true, {trim: true});
    parser.on('error', function(err) {
      throw err;
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
  }
  catch (sax_exception) {
    callback(sax_exception);
  }
}

function coalesce(body, callback) {
  /** Flickr doesn't always respond with JSON,
    1. It returns a querystring when there are (OAuth) errors.
    2. It returns xml for 'upload' and 'replace' requests.

    callback signature: function(err, response_object)
  */
  try {
    callback(null, JSON.parse(body));
  }
  catch (json_parse_exception) {
    // for example, an async upload response:
    // "<?xml version="1.0" encoding="utf-8" ?>
    // <rsp stat="ok">\n<ticketid>8412916-19001238788141232</ticketid>\n</rsp>\n"
    // or a normal upload:
    // <photoid>1234</photoid>
    // or a replace:
    // <photoid secret="abcdef" originalsecret="abcdef">1234</photoid>
    xml2js(body, function(err, doc) {
      callback(err, doc);
    });
  }
}

var requestFactory = module.exports = function(consumer_key, consumer_secret, oauth_token, oauth_token_secret) {
  /** set up a request factory, creating a closure of variables so that we can
  create multiple requests without unncessary re-initialization. */
  var oauth_client = new oauth.OAuth(
    oauth_endpoints.request, oauth_endpoints.access,
    consumer_key, consumer_secret, '1.0A', null, 'HMAC-SHA1');
  return function(opts, callback) {
    // callback signature: function(err, response_object)
    opts.api_key = consumer_key;
    request(opts, oauth_client, oauth_token, oauth_token_secret, function(err, response) {
      if (err) {
        callback(err);
      }
      else {
        readToEnd(response, function(err, body) {
          if (err) {
            callback(err);
          }
          else {
            coalesce(body, callback);
          }
        });
      }
    });
  };
};

requestFactory.oauth_endpoints = oauth_endpoints;
requestFactory.request = request;
