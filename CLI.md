# Flickr Sync

### Quickstart

    npm install -g flickr-sync
    vim ~/.flickr
    > {"consumer_key": "...", "consumer_secret": "...",
    >  "oauth_token": "...-...", "oauth_token_secret": "..."}
    flickr sync --directory ~/Pictures

## Motivation

Flickr offers unlimited storage for Pro accounts, and one terabyte to free accounts (that's 100,000 10MB pictures). They allow you to have private photos, so they are an excellent photo backup service. They have [a great API](http://www.flickr.com/services/api/), and lots of apps. But I don't trust those apps (and many of the backup ones cost money), so I made my own backup script.

## Installation

1. Get `Node.js` and `npm` if you don't already have them.
    - To see if you have node, run `node --version` and if it returns something like `v0.10.15`, you do.
    - [Node.js install instructions](http://chbrown.github.io/#nodejs--npm)
2. Install the `flickr-sync` package:
    - `npm -g install flick-sync`
3. Get OAuth credentials for using the Flickr API:
    - Go to [www.flickr.com/services/apps/](https://www.flickr.com/services/apps/)
    - Click "Get another key" on the right.
    - Click "Apply for a non-commercial key"
    - Fill in some details and click the checkboxes, and you should get to a page with "Key:" and "Secret:" fields, fancy gold lettering on a black velvet background towards the top.
        * The "Key" field is your `consumer_key`.
        * The "Secret" field is your `consumer_secret`.
    - Here's the complicated part. At this point you need to get an OAuth token and secret that links your "app" with your "user", since the "app" you just "applied for" and created can't really do anything without users.
        * You can follow the process outlined in the [Flickr OAuth documentation](http://www.flickr.com/services/api/auth.oauth.html).
        * Or you can try out my [AutoAuth](https://github.com/chbrown/autoauth) package for help on getting these credentials together, perhaps a little easier than the official way, if you happen to have phantomjs already installed.
    - Eventually you'll need to end up with a file of credentials at `~/.flickr` or thereabouts, which looks like this:

```json
{
  "consumer_key": "i0LOwemEyB7SHoQgzGfvxPKjhlIbuDYs",
  "consumer_secret": "FnM2RhOwXjB5tVrl",
  "oauth_token": "FYSWxIJTGwvDHc98P-0n2tVdLUkmQsCBOX3",
  "oauth_token_secret": "H8RcVM96oLtA0Gpd"
}
```

(Those values are made up -- you'll need to get your own.)

## Usage

### `test` command

To test whether everything installed okay, run `flickr test`, which should print something like the following, only with your user id and username:

```json
{
  "user": {
    "id": "33947520@N00",
    "username": {
      "_content": "audiere"
    }
  },
  "stat": "ok"
}
```

### `api` command

Once you have the credentials in place, you can issue individual commands to the Flickr API.

**Upload a single file:**

    flickr api -m upload title=CrashReport photo=~/Desktop/crash-report.jpg

Note that this interface does not change the default public settings, unlike `flickr sync`, below! It only fills in the necessary OAuth credentials and signs the url.

**Get the [Flickr pandas](http://www.flickr.com/services/api/flickr.panda.getList.html):**

    flickr api -m flickr.panda.getList

Result:

```json
{
  "pandas": {
    "panda": [
      {
        "_content": "ling ling"
      },
      {
        "_content": "hsing hsing"
      },
      {
        "_content": "wang wang"
      }
    ]
  },
  "stat": "ok"
}
```

The CLI requires the `--method` (`-m`) flag to be set, and interprets any other positional arguments as parameters:

    flickr api -m flickr.photos.getInfo photo_id=7500858540

Result:

```json
{
  "photo": {
    "id": "7500858540",
    "dateuploaded": "1341407391",
    "license": "4",
    ...
    "owner": {
      "username": "audiere",
      ...
    },
    ...
    "media": "photo"
  },
  "stat": "ok"
}
```

You can also pipe in a file of parameters.

Let's say you accidentally created a lot of duplicates of one photoset, and you want to delete them all. The Flickr web UI is pretty slow and you can only delete one photoset at a time, so this could take a while. Let's say that you want to delete all your photosets that contain the string "Too many lemurs":

```bash
flickr api -m flickr.photosets.getList --select photosets.photoset | \
  json -C id title._content | \
  grep 'Too many lemurs' | \
  awk '{printf "photoset_id=%s\n",$1}' | \
  flickr api -m flickr.photosets.delete
```

* The `--select` flag pulls out a specific value or set of values from the response. If you select an array, it will output one json entry per line.
    - In this case, `--select photosets.photoset` selects the list of photoset object entries in the `photoset` field, which is a property of the root-level `photosets` dictionary.
* `json -C ...` filters out everything but a few of the fields (the photoset name and id) in and tab-separates them.
    - [`npm install -g json`](https://github.com/zpoley/json-command) to install
* `awk` pulls out just the photoset id, and puts the appropriate argument name in front of the value.
* Piping into `flickr api` will hit the API at `flickr.photosets.delete` once for each line of input.

### `sync` command

The star of the show, the sync helper will read a directory of directories of pictures files, and upload each photo as a member of a photoset corresponding to its parent album. Flickr [only supports](http://www.flickr.com/help/photos/#150488231) jpegs, gifs, pngs, and tiffs, so I match on this case-insensitive glob: `{gif,png,jpg,jpeg,tif,tiff}`. If the destination photoset does not already exist, it will be created.

All images are uploaded as completely private:

```javascript
{
  ...
  is_public: 0,
  is_friend: 0,
  is_family: 0,
  hidden: 2
}
```

For example, here is a snippet of my `~/Pictures` directory:

    /Users/chbrown/Pictures/
      - 20120710 Sarahs/
        - VB7O0896.JPG
        - VB7O0897.JPG
      - 20120722 Iceland - LungA/
        - VB7O3427.JPG
        - VB7O3428.JPG
        - VB7O3429.JPG
      - 20120806 Iceland - Snaefesnes/
        - VB7O3450.JPG
        - VB7O3451.JPG
        - VB7O3452.JPG
        - VB7O3453.JPG
        - VB7O3454.JPG

Each of my pictures happens to be about 10 MB, and I'm on my home wifi, so I would run:

    flickr sync --directory ~/Pictures --workers 5

For smaller pictures, or if you have a whole lot of bandwidth, you can add more workers.

    flickr sync --directory ~/Pictures --workers 20
