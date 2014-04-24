var phantom = require('./');
var fs = require('fs');

var render = phantom();
render('http://sorribas.org').pipe(fs.createWriteStream('sorribas.png'));