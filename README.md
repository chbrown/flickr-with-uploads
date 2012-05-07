# node-flickr

__A simple node wrapper for the Flickr API that supports oAuth authentication__

This is a small library that adds a thin wrapper around the Flickr API to make it easier to 
call methods, sign them when necessary.

It currently does __not__ support the RSS/Atom feeds, nor does it handle the 
oAuth login process. It may in the future -- I'd appreciate any patches if you have time.

The library is heavily inspired by the 
[flickrnode library by Ciaran Jessup](https://github.com/ciaranj/flickrnode).

__Current Test Status__: [![Build Status](https://secure.travis-ci.org/sujal/node-flickr.png)](http://travis-ci.org/sujal/node-flickr)

## Usage

Install the library into your package.json file or using the following command:

    npm install flickr

Once installed, you can interact with the library with something like this:

````javascript
var Flickr = require('flickr').Flickr;

var client = new Flickr('YOUR_CONSUMER_KEY/API_KEY', 'YOUR_CONSUMER_SECRET', 
                        {"oauth_token": 'optional oauth token', "oauth_token_secret": 'optional oauth token secret'});

````

Some examples follow.

## Examples

_Coming Soon_

## Development

Contributions are welcome. Please feel free to submit pull requests. I prefer that pull requests
come from properly named feature branches (_don't dev in master!_). This makes it easier for people
scanning the Network tab above to see what your fork offers.

### Running tests

To setup your local copy for testing, I recommend you run 

    npm link

in the project directory to
install all the dependencies. I found that easiest.

Next, create a .env file in the root of the project directory. The `Makefile` 
sets up the testing environment to use those values. 
Yes, the tests run against the live API (for now).

You should probably start with the following contents:

````
FLICKR_API_KEY=<Your API Key>
FLICKR_API_SECRET=<Your API Secret>
FLICKR_OA_TOKEN=<A valid access token>
FLICKR_OA_TOKEN_SECRET=<A valid access token secret>
````

To get the access token and the access token secret, you will need to go through 
the OAuth dance. You can use something like [this OAuth test client](http://term.ie/oauth/example/client.php)
to generate those values. Using that tool is beyond the scope of this readme.

Then, whenever you want to run tests:

````
make test
````

You should get a nicely formatted output for your tests. You can also override the 
reporter used by Mocha by setting a `REPORTER` value in `.env`. Read the `Makefile`
for details.

## License

See the LICENSE file for details.

