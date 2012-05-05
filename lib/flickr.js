
exports.Flickr = function(consumer_key, consumer_secret, options) {
  
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
  
}

exports.Flickr.prototype.setOAuthTokens = function(oauth_token, oauth_token_secret) {
  this.oauth_token = oauth_token;
  this.oauth_token_secret = oauth_token_secret;
}

exports.Flickr.prototype.executeAPIRequest = function (method, arguments, authenticated, options) {
  
}
