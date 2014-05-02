# Flickr API + uploads

My use-case project, [flickr-sync](https://github.com/chbrown/flickr-sync), was recently merged into this project.
This brought on a few additional dependencies, but no API changes. All library calls to [flickr-with-uploads](https://github.com/chbrown/flickr-with-uploads) and flickr-sync are the same as before, but both are implemented in flickr-with-uploads. The flickr-sync CLI has also been merged over into this package.


## Installation

If you have already installed `flickr-sync` globally, do a quick cleanup: `npm uninstall -g flickr-sync`

Or if it's too late for that, the important bit is getting rid of `flickr-sync`'s ownership of the `flickr` script on your `PATH`, so `rm $(which flickr)` will do the trick.

**With `npm`:**

```bash
npm install -g flickr-with-uploads
```

Or require the library from your `package.json`:

```json
{
  ...
  "dependencies" : {
    "flickr-with-uploads": "*",
    ...
  }
}
```

## Usage

First we want to prepare a closure preloaded with our credentials, which we'll call `api`:

```javascript
var flickr = require('flickr-with-uploads');
var api = flickr(
  '0RjUImXvsYx2P8Gi4eZScFh9fkLJltDV', // consumer_key
  'mbu87dOB0FWncTRJ', // consumer_secret
  '3XF0pqP4daZf9oIlx-a7H1uMLeGrBidkJU', // oauth_token
  'KpslBxHoh4QYk6ad'); // oauth_token_secret
```

I keep these in a JSON file at `~/.flickr`, which is what [flickr-sync](https://github.com/chbrown/flickr-sync), so if you plan on using that, this is probably the way to go.

```json
{
  "consumer_key": "0RjUImXvsYx2P8Gi4eZScFh9fkLJltDV",
  "consumer_secret": "mbu87dOB0FWncTRJ",
  "oauth_token": "3XF0pqP4daZf9oIlx-a7H1uMLeGrBidkJU",
  "oauth_token_secret": "KpslBxHoh4QYk6ad"
}
```

(All my values are fake, obviously---actual Flickr credentials are all hexadecimal.)

## Examples

Using the `api` function from above, let's upload a file.

```javascript
var fullpath = '/Users/chbrown/Pictures/Seaworld - The Heist/orca_019.jpg';
// the upload method is special, but this library automatically handles the
// hostname change
api({
  method: 'upload',
  title: 'My new pet: baby orca',
  description: "Don't tell Seaworld!",
  is_public: 0,
  is_friend: 1,
  is_family: 1,
  hidden: 2,
  photo: fs.createReadStream(fullpath)
}, function(err, response) {
  if (err) {
    console.error('Could not upload photo:', err);
  }
  else {
    var new_photo_id = response.photoid._content;
    // usually, the method name is precisely the name of the API method, as they are here:
    api({method: 'flickr.photos.getInfo', photo_id: new_photo_id}, function(err, response) {
      console.log('Full photo info:', response);
      api({method: 'flickr.photosets.addPhoto', photoset_id: 1272356126, photo_id: new_photo_id}, function(err, response) {
        console.log('Added photo to photoset:', response);
      });
    });
  }
});
```

## Related

This library was (re)written to support my [flickr-sync](https://github.com/chbrown/flickr-sync) project, which is a script to backup a directory of directories full of pictures as sets of photos to Flickr. Since Pro accounts have unlimited storage on Flickr, and they allow totally private photos, it's a great archival service.

See [flickr-sync](https://github.com/chbrown/flickr-sync) for many more examples of using this library (it has been updated to use the ~1.0 version).


### Flickr API Examples

Here are some sample responses that the Flickr API will send back for a couple of API methods (usually the responses are much longer, I'm abbreviating here to the interesting stuff (for example, you'll always get a `{ stat: 'ok' }` value for successful queries, but I don't include that here):

#### flickr.photosets.getList

    {
      photosets: {
        photoset: [
          { id: '72147630888316081', primary: '7500858540', secret: '3bedf92dec', server: '8214', farm: 9,
            photos: 3, videos: '0', title: { _content: '20120716 Iceland - Reykjavik' },
            description: { _content: 'flickr-store' }, needs_interstitial: 0, visibility_can_see_set: 1,
            count_views: '0', count_comments: '0', can_comment: 1,
            date_create: '1344024608', date_update: '1344024918' },
          ...
        ]
      }
    }

#### flickr.photos.search

    {
      photos: {
        photo: [
          { id: '7500858540', owner: '33947520@N00', secret: 'f38df12d5c',
            server: '8014', farm: 9, title: 'flickr-store',
            ispublic: 0, isfriend: 0, isfamily: 0 }
        ],
        ...
      }
    }

#### flickr.test.login

    {
      user: { id: '33947520@N00', username: { _content: 'audiere' } },
      stat: 'ok'
    }

## Development

Fixes are totally welcome! In the master branch, even! Just use sane formatting (like what [jsbeautifier.org](http://jsbeautifier.org/) uses, but with 2-space indents, not 4).

Excepting any hashbang, the following should head all `*.js` files:

    /*jslint node: true */

### Dependencies

* `form-data`, to assemble urls for OAuth signing
* [`oauth`](https://github.com/chbrown/node-oauth.git), to add OAuth url signatures

I've sent a pull request to ciaranj's `node-oauth`, for some required functionality to allow signing but not GET/POSTing with that OAuth library. For the time being, this package requires my fork, which includes that functionality.

      // var wrapped_api = function(opts, callback) {
      //   logger.info('Flickr API request: %s', opts);
      //   api(opts, function(err, response_object) {
      //     logger.info(response_object, 'Flickr API response');
      //     callback(err, response_object);
      //   });
      // };


## References

https://www.flickr.com/services/api/misc.urls.html

## License

Copyright © 2012–2014 Christopher Brown. [MIT Licensed](LICENSE).
