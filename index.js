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
	var maxRetries = opts.retries || 1;

	var filename = 'phantom-queue-' + process.pid + '-' + Math.random().toString(36).slice(2);
	if (opts.fifoDir) filename = path.join(opts.fifoDir, filename);
	else filename = path.join(os.tmpDir(), filename);

	var reader;
	var readNextResult = function(done) {
		var cb = once(function(err, stream) {
			reader = null;
			done(err, stream)
		});

		var result = reader = platform === 'win32' ? fakeFifo(filename, inc++) : fs.createReadStream(filename);

		result.on('error', cb);
		result.on('close', function() {
			cb(new Error('Render failed (no data)'));
		});

		result.once('readable', function() {
			var first = result.read(2) || result.read(1);
			// Receiving exactly a "!" back from phantom-process.js indicates failure.

			if (first && first.toString() === '!') {
				result.destroy();
				return cb(new Error('Render failed'));
			}

			result.unshift(first);
			cb(null, result);
		});
	};

	var update = function() {
		if (!queue.length || queue[0].tries) return;

		if (opts.debug) console.log('queue size: '+queue.length);

		var timeout;

		var retry = function() {
			var first = queue[0];
			first.tries++;
			ensure().stdin.write(first.message);
			readNextResult(function(err, stream) {
				if (timeout) clearTimeout(timeout);
				if (err && first.tries++ < maxRetries) return retry();
				queue.shift().callback(err, stream);
				if (opts.debug) console.log('queue size: '+queue.length);
			})
		};

		var kill = function() {
			if (child) child.kill();
		};

		retry();
		if (opts.timeout) timeout = setTimeout(kill, opts.timeout);
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
			if (reader) reader.destroy();
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

			update();
			cb(err, stream);
		};

		fifo(function(err) {
			if (err) return done(typeof err === 'number' ? new Error('mkfifo exited with '+err) : err);

			queue.push({
				callback: done,
				message: JSON.stringify(ropts)+'\n',
				tries: 0
			});

			update();
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
		if (ropts.crop === true) ropts.crop = {top:0, left:0}

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
