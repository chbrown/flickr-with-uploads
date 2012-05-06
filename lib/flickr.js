var sys = require("sys")
    , http = require("http")
    , util = require('util')
    , OAuth = require("oauth").OAuth;
   
exports.Flickr = function(consumer_key, consumer_secret, options) {
  
  options = options || {};

  this.consumer_key = consumer_key;
  this.consumer_secret = consumer_secret;
  this.oauth_token = options["oauth_token"] || null;
  this.oauth_token_secret = options["oauth_token_secret"] || null;
  
  // process options
  
  this.baseUrl = options["baseUrl"] || "/services/rest";
  
  this.oauth_client = new OAuth("http://www.flickr.com/services/oauth/request_token",
                                "http://www.flickr.com/services/oauth/access_token",
                                consumer_key,
                                consumer_secret,
                                "1.0A",
                                null,
                                "HMAC-SHA1");
  
};

exports.Flickr.prototype.setOAuthTokens = function(oauth_token, oauth_token_secret) {
  this.oauth_token = oauth_token;
  this.oauth_token_secret = oauth_token_secret;
};

exports.Flickr.prototype.executeAPIRequest = function (method, params, signed_in, optionsOrCallback) {
  
  var callback = optionsOrCallback;
  var options = null;

  if (arguments.length == 4 && typeof optionsOrCallback == "object") {
    callback = arguments[3];
    options = optionsOrCallback;
  }
  
  if( params === undefined )  params = {};
  
  // apply default arguments 
  params.format= "json";
  params.nojsoncallback= "1";
  params.method = method;
  
  if (signed_in === true) {
    // use OAuth client 
    this._executeOAuthAPIRequest(params, options, callback);
  } else {
    // use simple API token method
    this._executeNoAuthAPIRequest(params, options, callback);
  }
  
};

exports.Flickr.prototype._executeNoAuthAPIRequest = function(params, options, callback) {

  var oauth_token = options["oauth_token"] || this.oauth_token;
  var oauth_token_secret = options["oauth_token_secret"] || this.oauth_token_secret;
  
  var queryString = this.paramsToQueryString(params);

  var request = oa.get("http://api.flickr.com" + this.baseUrl + queryString, 
                          oauth_token, oauth_token_secret, function(error, data){
    if (error) {
      callback(error);
    } else {
      this.processResponse(data, options, callback);
    }
  });
  
};

exports.Flickr.prototype._executeNoAuthAPIRequest = function(params, options, callback) {

  var flickr_instance = this;
  
  // add security
  params.api_key = this.consumer_key;
  
  var queryString = this.paramsToQueryString(params);
  
  // console.log("queryString is " + queryString);
  
  var request = this.getHttpClient().request("GET", 
                            this.baseUrl+ queryString, 
                            {"host": "api.flickr.com"});
                            
  request.addListener('response', function(response){
    var result= "";
    response.setEncoding("utf8");
    response.addListener("data", function (chunk) {
      result+= chunk;
    });
    response.addListener("end", function () {   

      flickr_instance.processResponse(result, options, callback);

    }); // end addListener for end
  });
  request.end();
};

exports.Flickr.prototype.processResponse = function(response_body, options, callback) {
  
  options = options || {};
  var result_mapper = options["result_mapper"];
  var ourCallback = callback;
  
  // comment from Flickrnode:
  // Bizarrely Flickr seems to send back invalid JSON (it escapes single quotes in certain circumstances?!?!!?)
  // We fix that here.
  if( response_body ) {  
      response_body = response_body.replace(/\\'/g,"'");
  }
  
  // console.log("response_body was " + util.inspect(response_body));

  var res = JSON.parse(response_body);
  if( res.stat && res.stat == "ok" ) {
      // Munge the response to strip out the stat and just return the response value
      for(var key in res) {
          if( key !== "stat" ) {
              res= res[key];
          }
      }

      if( result_mapper ) {
          res = result_mapper(res);
      }

      ourCallback(null, res);
  } 
  else {
      
      ourCallback(new Error("Flickr Error ("+res.code+"): " + res.message));;
  }
  

};

exports.Flickr.prototype.getHttpClient= function() {
    return http.createClient(80, "api.flickr.com");
};

exports.Flickr.prototype.paramsToQueryString = function (params) {
  var queryString = "";
  var operator= "?";
  for(var key in params) {
      queryString += (operator + key + "=" + encodeURIComponent(params[key]));
      if( operator == "?" ) operator= "&";
  }
  return queryString;
}