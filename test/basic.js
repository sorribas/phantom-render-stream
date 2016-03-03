var concat = require('concat-stream');
var test = require('./helpers/test');
var phantom = require('../');

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

test('expects, with option passed to render()', function(host, t) {
  var render = phantom();
  render(host +'/?expects', {expects:'lols'}).pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    t.end();
  }));
});

test('expects failure case, with option passed to render()', function(host, t) {
  var render = phantom();
  render(host +'/?expects', {expects:'meh'}).on('error', function(err) {
    t.ok(err);
    t.end();
  });
});

test('expects, with option passed to phantom()', function(host, t) {
  var render = phantom({expects:'lols'});
  render(host +'/?expects').pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    t.end();
  }));
});

test('expects failure case, with options passed to phantom()', function(host, t) {
  var render = phantom({expects:'meh'});
  render(host +'/?expects').on('error', function(err) {
    t.ok(err);
    t.end();
  });
});

test('expects with window.renderable appearing before timeout should work', function (host,t) {
  var render = phantom({expects:'lols', timeout:5000});
  render(host +'/?slow-expects').pipe(concat(function(data) {
    t.ok(data);
    t.ok(data.length > 0);
    t.end();
  }));
});

test('timeout', function(host, t) {
  var render = phantom({timeout: 100});
  render(host + '/?timeout').on('error', function(err) {
    t.ok(err);
    t.end();
  });
});

test('emits phantom logs - console', function(host, t) {
  var render = phantom();
  render(host + '/?log-console')
    .on('log', function(log) {
      t.equal(log.type, 'consoleMessage');
      t.equal(log.data.msg, 'useful log');
      t.end();
    });
});

test('emits phantom logs - js errors', function(host, t) {
  var render = phantom();
  render(host + '/?log-error')
    .on('log', function(log) {
      t.equal(log.type, 'error');
      t.equal(log.data.msg, 'ReferenceError: Can\'t find variable: a');
      t.ok(log.data.trace);
      t.end();
    });
});
