# phantom-render-stream

Render a webpage and get the image as a stream.

```
npm install phantom-render-stream
```

[![Build Status](https://travis-ci.org/e-conomic/phantom-render-stream.png)](https://travis-ci.org/e-conomic/phantom-render-stream)

It uses a pool of phantom processes so it doesn't need to spawn a new process for each website.
New requests are added to the pool member with the shortest queue length.

## Synopsis

This module depends on the [phantomjs-prebuilt](https://www.npmjs.org/package/phantomjs-prebuilt) module, which will install
[PhantomJS](http://phantomjs.org/) for you if you don't already have it.

``` js
var phantom = require('phantom-render-stream');
var fs = require('fs');

var render = phantom();

// render a website url

render('http://example.com/my-site')
  .pipe(fs.createWriteStream('out.png'));

// or as a transform stream

fs.createReadStream('some-html-file.html')
  .pipe(render())
  .pipe(fs.createWriteStream('out.png'))
```

You can also pass some options:

``` js
var render = phantom({
  pool        : 5,           // Change the pool size. Defaults to 1
  timeout     : 1000,        // Set a render timeout in milliseconds. Defaults to 30 seconds.
  tmp         : '/tmp',      // Set the tmp where tmp data is stored when communicating with the phantom process.
                             //   Defaults to /tmp if it exists, or os.tmpDir()
  format      : 'jpeg',      // The default output format. Defaults to png
  quality     : 100,         // The default image quality. Defaults to 100. Only relevant for jpeg format.
  width       : 1280,        // Changes the width size. Defaults to 1280
  height      : 800,         // Changes the height size. Defaults to 960
  paperFormat : 'A4',        // Defaults to A4. Also supported: 'A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'.
  orientation : 'portrait',  // Defaults to portrait. 'landscape' is also valid
  margin      : '0cm',       // Defaults to 0cm. Supported dimension units are: 'mm', 'cm', 'in', 'px'. No unit means 'px'.
  userAgent   : '',          // No default.
  headers     : {Foo:'bar'}, // Additional headers to send with each upstream HTTP request
  paperSize:  : null,        // Defaults to the paper format, orientation, and margin.
  crop        : false,       // Defaults to false. Set to true or {top:5, left:5} to add margin
  printMedia  : false,       // Defaults to false. Force the use of a print stylesheet.
  maxErrors   : 3,           // Number errors phantom process is allowed to throw before killing it. Defaults to 3.
  expects     : 'something', // No default. Do not render until window.renderable is set to 'something'
  retries     : 1,           // How many times to try a render before giving up. Defaults to 1.
  phantomFlags: ['--ignore-ssl-errors=true'] // Defaults to []. Command line flags passed to PhantomJS
  maxRenders  : 500,          // How many renders can a phantom process make before being restarted. Defaults to 500

  injectJs    : ['./includes/my-polyfill.js'] // Array of paths to polyfill components or external scripts that will be injected when the page is initialized
});
```

Or override the options for each render stream

``` js
render(myUrl, {format:'jpeg', quality: 100, width: 1280, height: 960}).pipe(...)
```

## Supported output formats

We support the output formats that [PhantomJS's render method](http://phantomjs.org/api/webpage/method/render.html)
supports. At the time of this writing these are:

 * png
 * gif
 * jpg
 * pdf

## Example

Since the interface is just a stream you can pipe the web site anywhere!
Try installing [picture-tube](https://github.com/substack/picture-tube) and run the following example

``` js
var phantom = require('phantom-render-stream');
var pictureTube = require('picture-tube');
var render = phantom();

render('http://google.com')
  .pipe(pictureTube())
  .pipe(process.stdout);
```

## Deferred render

If you need your page to do something before phantom renders it you just need to immediately set
`window.renderable` to false. If that is set when the page is opened the module will wait for
`window.renderable` to be set to true and when this happens the render will occur.

Here is an example to illustrate it better.

``` html
<!DOCTYPE HTML>
<html lang="en">
<head>
  ...
  <script type="text/javascript">window.renderable = false</script>
  <meta charset="UTF-8">
  <title></title>
</head>
<body>

</body>
...
<script type="text/javascript">
  doSomeAjaxLoading(function() {
    doSomeRendering();
    window.renderable = true;
  })
</script>
</html>
```

## Adding Cookies
You can add any special cookies at render time.  For format, see http://phantomjs.org/api/webpage/method/add-cookie.html.  Example:

```javascript
var render = phantom({
  pool: 5,
  format: 'pdf'
  // other opts
});

render('http://somewhere.com', {
  cookies: [{
    'name'     : 'Valid-Cookie-Name',   /* required property */
    'value'    : 'Valid-Cookie-Value',  /* required property */
    'domain'   : 'localhost',
    'path'     : '/foo',                /* required property */
    'httponly' : true,
    'secure'   : false,
    'expires'  : (new Date()).getTime() + (1000 * 60 * 60)   /* <-- expires in 1 hour */
  }]
}).pipe(somewhereElse);
```
That will use that cookie for that particular render job.  You probably want to set the `expires` property to something fairly short, as there may not be a guarantee that a pooled phantom process won't pick up the cookie for a particular render job, and you may want that session to only be valid for an individual job run.

## Injecting JavaScript
Sometimes you need to inject [polyfills, e.g. PhantomJS Date.parse is broken](https://github.com/ariya/phantomjs/issues/11151).
You can add paths to local files to polyfill broken / missing features of PhantomJS using the `opts.injectJs` property.  Example:

```javascript
var phantom = render({
  injectJs: ['./includes/my-date-polyfill.js']
});
```

Obviously, make sure the path './includes/my-date-polyfill.js' is resolvable from the project root, or pass in an absolute path.
When the page is [initialized](http://phantomjs.org/api/webpage/handler/on-initialized.html), any scripts you listed there will
be injected before any rendering happens.


## Extra Dependencies

For rendering, PhantomJS requires the `fontconfig` library, which may be missing if you're using Ubuntu Server. To install on Ubuntu:

    sudo apt-get install libfontconfig

## Troubleshooting

Render stream emits "log" event with useful debug details coming from onError (JS error), onConsoleMessage, onResourceError, onResourceTimeout webpage hooks.

```javascript
var render = phantom();

render('http://somewhere.com')
  .on('log', function(log) {
    // {type: 'error', data: {msg: 'ReferenceError: Can\'t find variable: a', trace: [..]}}
  })
  .pipe(res);
```

Also, some additional debugging output may be enabled by running your app with a
`DEBUG` environment variable set as follows:

    DEBUG=phantom-render-stream  node ./your-script.js

If you are getting undefined error codes and responses when attempting to
render, it's likely a connection issue of some sort. If the URL uses SSL,
adding `--ignore-ssl-errors=true` to phantomFlags may help. You also try adding
`--debug=true` to the `phantomFlags` array.


## See Also

 * [wkhtmltopdf](https://www.npmjs.org/package/wkhtmltopdf) is a Node module that uses [wkhtmltopdf](http://wkhtmltopdf.org/) to convert HTML to PDF. It is similar in that it uses Webkit and produces output as a stream, and different in that it doesn't use PhantomJS. Also, `wkhtmotopdf` only supports PDF output.

## License

[MIT](http://opensource.org/licenses/MIT)
