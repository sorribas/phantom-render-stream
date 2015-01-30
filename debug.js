// This a minimal script you can use for debugging
// It has debug options turned on for you.

var urlToDebug = process.argv[2]; 
if (!urlToDebug) {
  console.error("Must pass url to debug: debug.js http://example.com");
  process.exit(1);
}

process.env.DEBUG='phantom-render-stream';
var phantom = require('./');
var fs = require('fs');

var render = phantom({
  phantomFlags : ['--debug=true'],
  // Try ignoring SSL errors to see if that helps
  //phantomFlags : ['--debug=true','--ignore-ssl-errors=true'],

  // Try a long timeout and see if that helps
  //timeout: 1000000,
});

var outputStream = fs.createWriteStream('debug.png');

var renderStream = render(urlToDebug);

// Capturing the error event if your render stream is a good idea.
renderStream.on('error', function (msg) {
  console.log("ERROR: "+msg);
});

outputStream.on('finish', function () {
  console.log("Done. Review debug.png");
});

renderStream.pipe(outputStream);

