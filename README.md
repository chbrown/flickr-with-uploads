# node-flickr
__A simple node wrapper for the Flickr API that supports oAuth authentication__

This is a small library that adds a thin wrapper around the Flickr API to make it easier to 
call methods, sign them when necessary.

It currently does __not__ support the RSS/Atom feeds, nor does it handle the 
oAuth login process. It may in the future -- I'd appreciate any patches if you have time.

The library is heavily inspired by the 
[flickrnode library by Ciaran Jessup](https://github.com/ciaranj/flickrnode).

## Usage

Install the library into your package.json file or using the following command:

    npm install flickr

Once installed, you can interact with the library with something like this:

````javascript
var Flickr = require('flickr').Flickr;

var client = new Flickr('YOUR_CONSUMER_KEY/API_KEY', 'YOUR_CONSUMER_SECRET', '&lt;optional oauth token&gt;', '&lt;optional oauth token secret&gt;');

````

Some examples follow.

## Examples



## License

See the LICENSE file for details.

