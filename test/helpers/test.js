var tape = require('tape');
var http = require('http');
var proc = require('child_process');
var phantomjsPath = require('phantomjs').path;

var server;
module.exports = function(msg, fn) {
  tape(msg, function(t) {
    if (server) return fn('http://localhost:'+server.address().port, t);

    proc.exec(phantomjsPath + ' --version', function(err) {
      if (err) {
        t.fail('phantomjs module is not properly installed. Try re-installing it. Error was: '+err);
        process.exit(1);
      }

      server = http.createServer(function(req, res) {
        req.connection.unref();
        if (req.url.indexOf('slow-expects') > -1) {
            // The expected test appears slow. Tests a bug where a hardcoded timeout was preventing slow renders from succeeding.
            res.end('<html><head><script>window.renderable = false;setTimeout(function () { window.renderable="lols"; },2000);</script></head><body>hello</body></html>');
          return;
        }
        if (req.url.indexOf('expects') > -1) {
          res.end('<html><head><script>window.renderable = "lols"</script></head><body>hello</body></html>');
          return;
        }
        if (req.url.indexOf('timeout') > -1) {
          return; // do nothing...
        }
        res.end('hello world\n');
      });
      server.listen(0, function() {
        fn('http://localhost:'+server.address().port, t);
      });
      server.unref();
    });

  });
};
