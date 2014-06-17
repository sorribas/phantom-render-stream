var mkdirp = require('mkdirp');
var thunky = require('thunky');
var fs = require('fs');
var pump = require('pump');
var stream = require('stream');
var once = require('once');
var ldjson = require('ldjson-stream');
var duplexer = require('duplexer');
var proc = require('child_process');
var xtend = require('xtend');
var hat = require('hat');
var path = require('path');
var util = require('util');
var os = require('os');
var debugStream = require('debug-stream')('phantom-render-stream');
var phantomjsPath = require('phantomjs').path;

var noop = function() {};

var TMP = path.join(fs.existsSync('/tmp') ? '/tmp' : os.tmpDir(), 'phantom-render-stream');

var phantomProcessFlags = [];

var Proxy = function() {
  stream.Transform.call(this);
  this.bytesRead = 0;
  this.destroyed = false;
  this.on('end', function() {
    this.destroy();
  });
};

util.inherits(Proxy, stream.Transform);

Proxy.prototype._transform = function(data, enc, cb) {
  if (this.destroyed) return;
  this.bytesRead += data.length;
  cb(null, data);
};

Proxy.prototype.destroy = function(err) {
  if (this.destroyed) return;
  this.destroyed = true;
  if (err) this.emit('error', err);
  this.emit('close');
};

var spawn = function() {
  var phantomjsArgs = phantomProcessFlags.concat(path.join(__dirname, 'phantom-process.js'));
  var child = proc.spawn(phantomjsPath, phantomjsArgs);

  var input = ldjson.serialize();
  var output = ldjson.parse();

  child.stdout.pipe(debugStream('stdout')).pipe(output);
  input.pipe(debugStream('stdin')).pipe(child.stdin);

  var onerror = once(function() {
    child.kill();
  });

  child.stdin.on('error', onerror);
  child.stdout.on('error', onerror);
  child.stderr.on('error', onerror);

  var result = duplexer(input, output);

  result.process = child;

  result.destroy = function() {
    child.kill();
  };

  result.ref = function() {
    child.stdout.ref();
    child.stderr.ref();
    child.stdin.ref();
    child.ref();
  };

  result.unref = function() {
    child.stdout.unref();
    child.stderr.unref();
    child.stdin.unref();
    child.unref();
  };

  var onclose = once(function() {
    result.emit('close');
  });

  child.on('exit', onclose);
  child.on('close', onclose);

  return result;
};

var pool = function(size, timeout) {
  var workers = [];
  for (var i = 0; i < size; i++) workers.push({queued:[], stream:null});

  var dup = new stream.Duplex({objectMode:true});
  var interval;

  var ontimeout = function() {
    var now = Date.now();
    for (var i = 0; i < workers.length; i++) {
      var sent = workers[i].queued.length && workers[i].queued.sent;
      if (sent && (now - sent) > timeout) workers.stream.process.kill();
    }
  };

  if (timeout) {
    interval = setInterval(ontimeout, 2000);
    interval.unref();
  }

  var update = function() {
    for (var i = 0; i < workers.length; i++) {
      if (!workers[i].stream) continue;
      if (workers[i].queued.length) workers[i].stream.ref();
      else workers[i].stream.unref();
    }
  };

  var select = function() {
    var worker = workers.reduce(function(a,b) {
      return a.queued.length < b.queued.length ? a : b;
    });

    if (worker.stream) return worker;

    worker.stream = spawn();

    worker.stream.on('close', function() {
      var queued = worker.queued;
      worker.queued = [];
      worker.stream = null;

      // emit all data as success=false
      queued.forEach(function(data) {
        data.success = false;
        dup.push(data);
      });
    });

    worker.stream.on('data', function(data) {
      for (var i = 0; i < worker.queued.length; i++) {
        var cand = worker.queued[i];
        if (cand.id === data.id) {
          worker.queued.splice(i, 1);
          update();
          break;
        }
      }

      dup.push(data);
    });

    return worker;
  };

  dup.destroy = function() {
    if (interval) clearInterval(interval);
    workers.forEach(function(worker) {
      if (worker.stream) worker.stream.destroy();
    });
  };

  dup._write = function(data, enc, cb) {
    var worker = select();
    worker.queued.push(data);
    worker.stream.write(data);
    update();
    cb();
  };

  dup._read = function() {
    // do nothing ... backpressure is not an issue here
  };

  return dup;
};

var create = function(opts) {
  if (!opts) opts = {};

  var renderTimeout = opts.timeout;
  var poolSize = opts.pool || 1;
  var retries = opts.retries || 1;
  var tmp = opts.tmp || TMP;
  var format = opts.format || 'png';
  phantomProcessFlags = opts.phantomFlags || [];

  var worker = pool(poolSize, renderTimeout);
  var queued = {};

  worker.on('data', function(data) {
    var id = data.id;
    var proxy = queued[data.id];
    if (!proxy) return;

    if (!data.success && data.tries < retries) {
      fs.unlink(data.filename, noop);
      data.tries++;
      data.filename = path.join(tmp, hat()) + '.' + data.format;
      data.sent = Date.now();
      return worker.write(data);
    }

    delete queued[data.id];
    if (!data.success) return proxy.destroy(new Error('Render failed ('+data.tries+' tries)'));

    pump(fs.createReadStream(data.filename), proxy, function() {
      fs.unlink(data.filename, noop);
    });
  });

  var mkdir = thunky(function(cb) {
    mkdirp(tmp, cb);
  });

  var render = function(url, ropts) {
    ropts = xtend({format:format, url:url}, ropts);
    ropts.filename = path.join(tmp, hat()) + '.' + ropts.format;
    ropts.id = hat();
    ropts.sent = Date.now();
    ropts.tries = 0;
    if (ropts.crop === true) ropts.crop = {top:0, left:0};

    var proxy = queued[ropts.id] = new Proxy();

    mkdir(function(err) {
      if (err) return proxy.destroy(err);
      ropts.tries++;
      worker.write(ropts);
    });

    proxy.on('close', function() { // gc yo
      delete queued[ropts.id];
    });

    return proxy;
  };

  render.destroy = function(cb) {
    worker.destroy();
    if (cb) cb();
  };

  return render;
};

module.exports = create;
