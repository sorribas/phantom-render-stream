var fs = require('fs');
var cp = require('child_process');
var stream = require('stream');
var thunky = require('thunky');
var os = require('os');
var path = require('path');
var afterAll = require('after-all');
var xtend = require('xtend');
var once = require('once');
var http = require('http');
var phantomjsPath = require('phantomjs').path;
var fwd = require('fwd-stream');

var platform = process.platform;

var noop = function() {};

var fakeFifo = function(filename, inc) {
	var target = filename+'-'+inc;
	return fwd.readable(function(cb) {
		var tries = 10;
		var prevSize = 0;
		var kick = function() {
			fs.stat(target, function(err, st) {
				if (err) return setTimeout(kick, 100);
				if ((st.size && st.size !== prevSize) || (tries-- > 0 && !st.size)) {
					prevSize = st.size;
					return setTimeout(kick, 100);
				}
				var rs = fs.createReadStream(target);

				rs.on('close', function() {
					fs.unlink(target, noop);
				});

				cb(null, rs);
			});
		};

		kick();
	});
};

var spawn = function(opts) {
	opts = opts || {};
	var child;
	var queue = [];
	var inc = 0;

	var filename = 'phantom-queue-' + process.pid + '-' + Math.random().toString(36).slice(2);
	if (opts.fifoDir) filename = path.join(opts.fifoDir, filename);
	else filename = path.join(os.tmpDir(), filename);

	var looping = false;
	var loop = function() {
		if (looping) return;
		looping = true;

		var retries = 0;
		var timeoutFn = function() {
			if (++retries >= (opts.maxRetries || 2)) {
				cb(new Error('Too many retries'));
				looping = false;
				if (queue.length) loop();
			} else {
				timeout = setTimeout(timeoutFn, 5000);
				timeout.unref();
			}
			if (child) child.kill();
			
		};

		var timeout; 
		if (opts.timeout) {
			timeout = setTimeout(timeoutFn, opts.timeout);
			timeout.unref();
		}

		var result = platform === 'win32' ? fakeFifo(filename, inc++) : fs.createReadStream(filename);

		var cb = once(function(err, val) {
			clearTimeout(timeout);
			queue.shift().callback(err, val);
		});

		result.once('readable', function() {
			var first = result.read(2) || result.read(1);
			// Receiving exactly a "!" back from phantom-process.js indicates failure.
			if (first && first.toString() === '!') return cb(new Error('Render failed'));

			result.unshift(first);
			cb(null, result);
		});

		result.on('error', cb);

		result.on('close', function() {
			cb(new Error('Render failed (no data)'));

			looping = false;
			if (queue.length) loop();
		});
	};

	var ensure = function() {
		if (child) return child;

		inc = 0;
		child = cp.spawn(phantomjsPath, [path.join(__dirname, 'phantom-process.js'), filename, platform]);

		var onerror = once(function() {
			child.kill();
		});

		child.stdin.on('error', onerror);
		child.stdout.on('error', onerror);
		child.stderr.on('error', onerror);

		child.stdin.unref();
		child.stdout.unref();
		child.stderr.unref();
		child.unref();

		if (opts.debug) {
			child.stderr.pipe(process.stdout);
			child.stdout.pipe(process.stdout);
		} else {
			child.stderr.resume();
			child.stdout.resume();
		}

		child.on('exit', function() {
			child = null;
			if (!queue.length) return;
			queue.forEach(function(el) {
				ensure().stdin.write(el.message);
			});
		});
		return child;
	};

	var fifo = thunky(function(cb) {
		if (platform === 'win32') return cb();
		cp.spawn('mkfifo', [filename]).on('exit', cb).on('error', cb);
	});

	var free = function() {
		ret.using--;
	};

	var ret = function(ropts, cb) {
		ret.using++;

		var done = function(err, stream) {
			if (stream) stream.on('end', free);
			else free();
			cb(err, stream);
			if (opts.debug) console.log('queue size: ', queue.length);
		};

		fifo(function(err) {
			if (err) return done(typeof err === 'number' ? new Error('mkfifo exited with '+err) : err);
			var msg = JSON.stringify(ropts)+'\n';
			queue.push({callback: done, message: msg, date: Date.now()});
			ensure().stdin.write(msg);
			if (queue.length === 1) loop();
			if (opts.debug) console.log('queue size: ', queue.length);
		});
	};

	ret.using = 0;
	ret.destroy = function(cb) {
		if (child) child.kill();
		fs.unlink(filename, function() {
			if (cb) cb();
		});
	};

	return ret;
};

module.exports = function(opts) {
	opts = opts || {};
	opts.pool = opts.pool || 1;

	// Create a pool size equal to the number provided in opts.pool
	var pool = [];
	for (var i = 0; i < opts.pool; i++) {
		pool.push(spawn(opts));
	}

	var select = function() {
		return pool.reduce(function(a, b) {
			return a.using <= b.using ? a : b;
		});
	};

	var render = function(url, ropts) {
		ropts = xtend(opts, ropts);
		ropts.url = url;
		var pt = stream.PassThrough();
		select()(ropts, function(err, stream) {
			if (err) return pt.emit('error', err);
			if (destroyed) return stream.destroy();
			stream.pipe(pt);
			pt.destroy = once(function() {
				stream.destroy();
				pt.emit('close');
			});
		});

		var destroyed = false;
		pt.destroy = once(function() {
			destroyed = true;
			pt.emit('close');
		});

		return pt;
	};

	render.destroy = function(cb) {
		var next = afterAll(cb);
		pool.forEach(function(ps) {
			ps.destroy(next());
		});
	};

	return render;
};
