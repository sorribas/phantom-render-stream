var phantom = require('./');
var fs = require('fs');

var render = phantom();
var outputStream = fs.createWriteStream('sorribas.png');

// Close the phantom process when we are done streaming
outputStream.on('finish', function () {
  render.destroy();
});

render('http://sorribas.org').pipe(outputStream);
