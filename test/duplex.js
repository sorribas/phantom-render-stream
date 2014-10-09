var concat = require('concat-stream');
var test = require('tape');
var buffer = require('./helpers/buffer');
var phantom = require('../');

var simple = function() {
  return buffer('hello world\n');
};

var expects = function() {
  return buffer('<html><body>hello</body><script>window.renderable = "lols"</script></body></html>');
};

test('duplex simple render', function(t) {
  var render = phantom();
  simple()
    .pipe(render())
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
      t.end();
    }));
});

test('duplex simple render twice', function(t) {
  var render = phantom();
  simple()
    .pipe(render())
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);

      simple()
        .pipe(render())
        .pipe(concat(function(data) {
          t.ok(data);
          t.ok(data.length > 0);
          t.end();
        }));
  }));
});

test('duplex simple render parallel', function(t) {
  var render = phantom();
  t.plan(4);
  simple()
    .pipe(render())
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
    }));
  simple()
    .pipe(render())
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
    }));
});

test('duplex pool render twice', function(t) {
  var render = phantom({pool:2});
  simple()
    .pipe(render())
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);

      simple()
        .pipe(render())
        .pipe(concat(function(data) {
          t.ok(data);
          t.ok(data.length > 0);
          t.end();
        }));
  }));
});

test('duplex pool render parallel', function(t) {
  var render = phantom({pool:2});
  t.plan(4);
  simple()
    .pipe(render())
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
    }));
  simple()
    .pipe(render())
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
    }));
});

test('duplex expects', function(t) {
  var render = phantom();
  expects()
    .pipe(render({expects:'lols'}))
    .pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
      t.end();
    }));
});

test('duplex expects fail', function(t) {
  var render = phantom();
  expects()
    .pipe(render({expects:'meh'}))
    .on('error', function(err) {
      t.ok(err);
      t.end();
    });
});
