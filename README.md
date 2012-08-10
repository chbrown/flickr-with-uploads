# flickr-with-uploads

124-line Node.js wrapper for the Flickr API, using oAuth authentication, supporting uploads.

It currently supports only Flickr's "API Methods" (on the right side of the page [Flickr API Documentation](http://www.flickr.com/services/api/)), and [Uploading](http://www.flickr.com/services/api/upload.api.html).

A pull request is in the process, to ciaranj's `node-oauth`, for some required functionality to allow signing but not GET/POSTing with that oAuth library. For the time being, this package requires my `node-oauth` fork, which includes that functionality.

The library is forked from [node-flickr](https://github.com/sujal/node-flickr), but I pretty much rewrote the whole flickr.js file. I fixed the formatting, simplified the signing or not-signing handling, and **most importantly** now support uploading. Even though I added a pretty big feature, I decreased the line count from 158 to 124.
[node-flickr](https://github.com/sujal/node-flickr), in turn, is heavily inspired by [the flickrnode library by Ciaran Jessup](https://github.com/ciaranj/flickrnode).

## Initialization

Install the library into your package.json file or using the following command:

    npm install flickr-with-uploads

````javascript
var Flickr = require('flickr').Flickr;

// constructor arguments: new Flickr(consumer_key, consumer_secret, oauth_token, oauth_token_secret, base_url)
var client = new Flickr('0RjUImXvsYx2P8Gi4eZScFh9fkLJltDV', 'mbu87dOB0FWncTRJ',
  '3XF0pqP4daZf9oIlx-a7H1uMLeGrBidkJU', 'KpslBxHoh4QYk6ad')
````

I read in options from a `.env` file like so, but you can do it however you want:

````javascript
function readOptions(callback) {
  fs.readFile(path.join(__dirname, '.env'), 'utf8', function(err, text) {
    var opts = {};
    if (!err) {
      text.split(/\n/).forEach(function(line) {
        var line_parts = line.split(/\=/);
        opts[line_parts[0]] = line_parts[1];
      });
    }
    callback(err, opts);
  });
}
````

And my .env file (all my values are fake, obviously--actual credentials are all hexadecimal):

    FLICKR_API_KEY=0RjUImXvsYx2P8Gi4eZScFh9fkLJltDV
    FLICKR_API_SECRET=mbu87dOB0FWncTRJ
    FLICKR_OA_TOKEN=3XF0pqP4daZf9oIlx-a7H1uMLeGrBidkJU
    FLICKR_OA_TOKEN_SECRET=KpslBxHoh4QYk6ad

And then since all my calls are signed, I wrote a helper function, `api`:

````javascript
function api(method_name, data, options, callback) {
  // overloaded as (method_name, data, callback)
  return client.createRequest(method_name, data, true, options, callback).send();
}
````

## Examples

Using my `api` function from above:

````javascript
var fullpath = '/Users/chbrown/Pictures/Seaworld - The Heist/orca_019.jpg';
var params = {
  title: 'My new pet: baby orca', description: "Don't tell Seaworld!",
  is_public: 0, is_friend: 1, is_family: 1, hidden: 2
};
var options = {
  method: 'POST',
  file: fs.createReadStream(fullpath, {flags: 'r'})
};
// the method_name gets the special value of "upload" for uploads.
api('upload', params, options, function(err, response) {
  if (err) {
    console.error("Could not upload photo: ", self.toString() + ". Error message:");
    console.error();
  }
  else {
    var photo_id = response.photoid;
    // usually, the method name is precisely the name of the API method, as they are here:
    api('flickr.photosets.addPhoto', {photoset_id: 1272356126, photo_id: photo_id}, function(err, response) {
      api('flickr.photos.getInfo', {photo_id: photo_id}, function(err, response) {
        console.log("Full photo info:", response.photo);
      });
    });
  }
});
````

## Development

Fixes are totally welcome! In the master branch, even! Just use sane formatting (like what jsbeautifier.org uses, but with 2-space indents, not 4).

## Dependencies

Just one dependency: [form-data](https://github.com/felixge/node-form-data). This is just for the uploads. It works awesome, only takes about three lines to use. felixge is the author of (node-formidable)[https://github.com/felixge/node-formidable], the awesome form parsing library.

## Related

The node-flickr rewrite was all just to support my (Flickr Backup Script)[https://github.com/chbrown/flickr-backup]. There are lots more examples in that code, too.

## License

MIT Licensed. See the LICENSE file for full text.
