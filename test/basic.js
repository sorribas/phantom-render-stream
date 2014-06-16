var concat = require('concat-stream');
var test = require('./helpers/test');
var phantom = require('../');
var fs = require('fs');

test('simple render', function(host, t) {
  var render = phantom();
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    t.end();
  }));
});

test('simple render twice', function(host, t) {
  var render = phantom();
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    render(host).pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
      t.end();
    }));
  }));
});

test('simple render parallel', function(host, t) {
  var render = phantom();
  t.plan(4);
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
  }));
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
  }));
});

test('pool render twice', function(host, t) {
  var render = phantom({pool:2});
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    render(host).pipe(concat(function(data) {
      t.ok(data);
      t.ok(data.length > 0);
      t.end();
    }));
  }));
});

test('pool render parallel', function(host, t) {
  var render = phantom({pool:2});
  t.plan(4);
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
  }));
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
  }));
});

test('non existing page', function(host, t) {
  var render = phantom();
  render('http://localhost:12398').on('error', function(err) {
    t.ok(err);
    t.end();
  });
});

test('print media', function(host, t) {
  var render = phantom({printMedia: true});
  render(host).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    t.end();
  }));
});

test('expects', function(host, t) {
  var render = phantom();
  render(host+'/?expects', {expects:'lols'}).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    t.end();
  }))
})

test('expects fail', function(host, t) {
  var render = phantom();
  render(host+'/?expects', {expects:'meh'}).on('error', function(err) {
    t.ok(err);
    t.end();
  });
})