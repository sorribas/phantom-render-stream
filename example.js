var phantom = require('./');
var fs = require('fs');

var render = phantom();
var outputStream = fs.createWriteStream('sorribas.png');

render('http://sorribas.org').pipe(outputStream);
