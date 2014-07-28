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
var debug = require('debug')('phantom-render-stream');
var debugStream = require('debug-stream')(debug);
var phantomjsPath = require('phantomjs').path;

var noop = function() {};

var TMP = path.join(fs.existsSync('/tmp') ? '/tmp' : os.tmpDir(), 'phantom-render-stream');

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

var spawn = function(opts) {
  var phantomjsArgs = opts.phantomFlags.concat(path.join(__dirname, 'phantom-process.js'));
  var child = proc.spawn(phantomjsPath, phantomjsArgs);
  debug('phantom (%s) spawned', child.pid);

  var input = ldjson.serialize();
  var output = ldjson.parse({strict: false});

  child.stdout.pipe(debugStream('phantom (%s) stdout', child.pid)).pipe(output);
  input.pipe(debugStream('phantom (%s) stdin', child.pid)).pipe(child.stdin);

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
    debug('phantom (%s) died', child.pid);
    result.emit('close');
  });

  child.on('exit', onclose);
  child.on('close', onclose);

  return result;
};

var noop = function() {};

var pool = function(opts) {
  var size = opts.pool;
  var timeout = opts.timeout;
  var maxErrors = opts.maxErrors;

  var workers = [];
  for (var i = 0; i < size; i++) workers.push({timeout:null, queued:[], stream:null, errors:0, kill:noop});

  var dup = new stream.Duplex({objectMode:true});

  var updateTimeout = function(worker) {
    if (!timeout) return;
    if (!worker.queued.length && worker.timeout) {
      clearTimeout(worker.timeout);
      worker.timeout = null;
    } else if (worker.queued.length && !worker.timeout) {
      worker.timeout = setTimeout(worker.kill, timeout);
    }
  };

  var updateReferences = function(worker) {
    if (!worker.stream) return;
    if (worker.queued.length) worker.stream.ref();
    else worker.stream.unref();
  };

  var update = function(worker) {
    updateTimeout(worker);
    updateReferences(worker);
  }

  var select = function() {
    var worker = workers.reduce(function(a,b) {
      return a.queued.length < b.queued.length ? a : b;
    });

    if (worker.stream) return worker;

    worker.stream = spawn(opts);
    worker.kill = worker.stream.process.kill.bind(worker.stream.process);

    worker.stream.on('close', function() {
      var queued = worker.queued;
      worker.queued = [];
      worker.stream = null;
      worker.errors = 0;

      // emit all data as success=false
      queued.forEach(function(data) {
        data.success = false;
        dup.push(data);
      });

      update(worker);
    });

    worker.stream.on('data', function(data) {
      if (!data.success) worker.errors++;
      else worker.errors = 0;

      if (worker.errors > maxErrors) worker.stream.destroy();
      for (var i = 0; i < worker.queued.length; i++) {
        var cand = worker.queued[i];
        if (cand.id === data.id) {
          worker.queued.splice(i, 1);
          update(worker);
          break;
        }
      }

      dup.push(data);
    });

    return worker;
  };

  dup.destroy = function() {
    workers.forEach(function(worker) {
      if (worker.stream) worker.stream.destroy();
    });
  };

  dup._write = function(data, enc, cb) {
    var worker = select();
    worker.queued.push(data);
    worker.stream.write(data);
    update(worker);
    cb();
  };

  dup._read = function() {
    // do nothing ... backpressure is not an issue here
  };

  return dup;
};

var create = function(opts) {
  if (!opts) opts = {};

  var defaultOpts = {
    pool         : 1,
    maxErrors    : 3,
    phantomFlags : [],
    timeout      : 30000,
    retries      : 1,
    tmp          : TMP,
    format       : 'png',
  };

  opts = xtend(defaultOpts,opts);

  var tmp     = opts.tmp;
  var format  = opts.format;

  var worker = pool(opts);
  var queued = {};

  worker.on('data', function(data) {
    var id = data.id;
    var proxy = queued[data.id];
    if (!proxy) return;

    if (!data.success && data.tries < opts.retries) {
      fs.unlink(data.filename, noop);
      data.tries++;
      data.filename = path.join(tmp, hat()) + '.' + data.format;
      data.sent = Date.now();
      return worker.write(data);
    }

    delete queued[data.id];
    if (!data.success) {
      fs.unlink(data.filename, noop);
      return proxy.destroy(new Error('Render failed ('+data.tries+' tries)'));
    }

    pump(fs.createReadStream(data.filename), proxy, function() {
      fs.unlink(data.filename, noop);
    });
  });

  var mkdir = thunky(function(cb) {
    mkdirp(tmp, cb);
  });

  var render = function(url, ropts) {
    ropts = xtend({format:format, url:url, printMedia: opts.printMedia}, ropts);
    ropts.filename = path.join(tmp, process.pid + '.' + hat()) + '.' + ropts.format;
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
