var should = require('should'),
    Flickr = require('../lib/flickr').Flickr;
    
describe('requests', function(){
  describe('basic unauthenticated requests', function(){
    it('should execute a search without error', function(done){
      this.timeout(5000);
      var client = new Flickr(process.env.FLICKR_API_KEY, process.env.FLICKR_API_SECRET);
      client.executeAPIRequest("flickr.photos.search",{text: "sujal"}, false, done);
    });
  });
  
  describe('authenticated requests', function(){
    it('should execute a simple echo call without error', function(done){

      var client = new Flickr(process.env.FLICKR_API_KEY, process.env.FLICKR_API_SECRET, 
                        {"oauth_token": process.env.FLICKR_OA_TOKEN, "oauth_token_secret": process.env.FLICKR_OA_TOKEN_SECRET});
      client.executeAPIRequest("flickr.test.login", null, true, function(err, response){
        if (err) { done(err); }
        response.should.have.property('user').with.property('id');
        done();
      });
    })
  });
});