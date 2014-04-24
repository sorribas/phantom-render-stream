var tape = require('tape');
var http = require('http');
var proc = require('child_process');

var server;
module.exports = function(msg, fn) {
	tape(msg, function(t) {
		if (server) return fn('http://localhost:'+server.address().port, t);

		proc.exec('phantomjs --version', function(err) {
			if (err) {
				t.fail('You need to install phantomjs and have it in your $PATH');
				process.exit(1);
			}

			server = http.createServer(function(req, res) {
				req.connection.unref();
				res.end('hello world\n');
			});
			server.listen(0, function() {
				fn('http://localhost:'+server.address().port, t);
			});
			server.unref();
		});

	});
};
