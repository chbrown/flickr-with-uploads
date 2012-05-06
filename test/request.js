var should = require('should'),
    Flickr = require('../lib/flickr').Flickr;
    
describe('requests', function(){
  describe('unauthenticated requests', function(){
    it('should execute without error', function(done){
      var client = new Flickr(process.env.FLICKR_API_KEY, process.env.FLICKR_API_SECRET);
      client.executeAPIRequest("flickr.photos.search",{text: "sujal"}, false, done);
    });
  });
});