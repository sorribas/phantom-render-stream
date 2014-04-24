var once = require('once');
var freeport = require('freeport');
var child_process = require('child_process');
var thunky = require('thunky');
var request = require('request');
var stream = require('stream');
var base64 = require('base64-stream');
var afterAll = require('after-all');

module.exports = function(opts) {
	opts = opts || {};
	opts.pool = opts.pool || 1;
	opts.wait = opts.wait || false;

	var destroyed = false;
	var phantom = function() {
		var open = function (cb) {
			if (destroyed) return cb(new Error('destroyed'));
			cb = once(cb);
			freeport(function(err, port) {
				if (err) return cb(err);
				var ps = child_process.spawn('phantomjs', [__dirname + '/phantom-server.js', port]);
				ps.on('error', cb);
				ps.unref();
				ps.stdout.once('data', function() {
					ps.stdout.unref();
					ps.stderr.unref();
					ps.stdin.unref();
					cb(null, 'http://localhost:' + port, ps);
				});
				ps.on('exit', function() {
					thunk = thunky(open);
				});
			});
		};

		var thunk = thunky(open);
		return function(cb) {
			thunk(cb);
		};
	};

	var pool = Array(opts.pool).join(',').split(',').map(phantom);
	var free = [].concat(pool);

	var queue = [];
	var openPhantom = function(cb) {
		if (!free.length) return queue.push(cb);
		var ph = free.pop();
		ph(function(err, host) {
			if (err) {
				free.push(ph);
				return cb(err)
			}
			cb(null, host, function() {
				free.push(ph);
				if (queue.length) openPhantom(queue.shift());
			});
		});
	};

	var render = function(url, format) {
		format = format || 'png';
		var decoder = base64.decode();
		var req;
		var destroyed = false;

		decoder.destroy = function() {
			if (req) req.destroy();
			else destroyed = true;
			decoder.emit('close');
		};

		openPhantom(function(err, host, free) {
			if (err) return decoder.emit('error', err);;
			if (destroyed) return free();
			free = once(free);

			req = request(host + '/' + format + '?url=' + encodeURIComponent(url));
			req.pipe(decoder);
			req.on('error', function(err) {
				decoder.emit('error', err);
				free();
			});
			decoder.on('finish', free);
		});

		return decoder;
	};

	render.destroy = function(cb) {
		var next = afterAll(cb || function() {});
		destroyed = true;
		pool.forEach(function(ph) {
			var cb = next();
			ph(function(err, host, ps) {
				if (err) return cb();
				ps.kill();
				ps.on('exit', function() {
					cb();
				});
			});
		});
	};
	
	return render;
};

var render = module.exports();
for (var i = 0; i < 10; i++) {
	render('http://google.com').pipe(require('fs').createWriteStream('/home/eduardo/Desktop/lalala'+i+'.png'));;
	render('http://sorribas.org').pipe(require('fs').createWriteStream('/home/eduardo/Desktop/lalalalala'+i+'.png'));;
}

//render.destroy();
