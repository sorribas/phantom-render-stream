# phantom-render-stream

Render a webpage and get the image as a stream.

	npm install phantom-render-stream

[![Build Status](https://travis-ci.org/e-conomic/phantom-render-stream.png)](https://travis-ci.org/e-conomic/phantom-render-stream)

It uses a pool of phantom processes so it doesn't need to spawn a new process for each website.

## Usage

First of all, you need to have phantomjs installed on the machine you use the module.

``` js
var phantom = require('phantom-render-stream');
var fs = require('fs');
var outputStream = fs.createWriteStream('out.png');

// Close the phantom process when we are done streaming
outputStream.on('finish', function () {
  render.destroy();
});

var render = phantom();
render('http://example.com/my-site').pipe(outputStream);
```

You can also pass some options

``` js
var render = phantom({
	pool: 5 // change the pool size. defaults to 1,
	format: 'jpeg' // the default output format
});
```

Or override the options for each render stream

``` js
render(myUrl, {format:'jpeg'}).pipe(...)
```

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

```html

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

## OS Dependencies

We `mkfifo` which is known to exist and work on OS X and Linux, but may not work other plaforms,
particularly Windows, which has different notions about named pipes.

## License

MIT
