# phantom-render-stream

Render a webpage and get the image as a stream.

	npm install phantom-render-stream

It uses a pool of phantom processes that runs a small webserver so it doesn't need
to spawn a new process for each website.

## Usage

``` js
var phantom = require('phantom-render-stream');
var fs = require('fs');

var render = phantom();
render('http://example.com/my-site').pipe(fs.createWriteStream('out.png'));
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

## License

MIT