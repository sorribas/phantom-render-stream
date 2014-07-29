// Code to be run by PhantomJS.
// The docs for these modules are here: http://phantomjs.org/api/
// Note that the 'fs' module here has a different API than the one in node.js core.
var webpage = require('webpage');
var system = require('system');

var page = webpage.create();

var forcePrintMedia = function() {
  page.evaluate(function() {
    var findPrintMedia = function() {
      var styles = [];

      Array.prototype.slice.call(document.querySelectorAll('style')).forEach(function(el) {
        styles.push(el.innerText);
      });
      Array.prototype.slice.call(document.querySelectorAll('link')).forEach(function(el) {
        if (el.rel && el.rel.indexOf('stylesheet') === -1) return;

        try {
          // try-catch is just precaution (we already set web-security to no)

          var xhr = new XMLHttpRequest();

          // 99.99% of the cases we just hit the cache so no real io
          xhr.open('GET', el.href, false);
          xhr.send(null);

          styles.push(xhr.responseText);
        } catch (err) {
          // do nothing
        }
      });

      var style = styles.join('\n');

      return style.split('@media print').slice(1).filter(function(text) {
        return text.indexOf('attr(href)') === -1;
      }).map(function(text) {
        var lvl = 0;

        var from = text.indexOf('{');

        for (var i = from; i < text.length; i++) {
          if (text[i] === '{') lvl++;
          if (text[i] === '}') lvl--;
          if (lvl === 0) break;
        }

        return text.substring(from+1, i-1);
      }).join('\n');
    };

    var div = document.createElement('div');

    div.innerHTML = '<style>\n'+findPrintMedia()+'\n</style>';
    document.body.appendChild(div);
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = 'white';
  });
};

var renders = 0, maxRenders = 500;
var loop = function() {
  var line = system.stdin.readLine();
  if (!line.trim()) return phantom.exit(0);

  try {
    line = JSON.parse(line);
  } catch (err) {
    return phantom.exit(1);
  }

  if (!page) page = webpage.create();

  if (line.cookies && line.cookies.length > 0) {
    line.cookies.forEach(function (c) {
      phantom.addCookie(c);
    });
  }

  // inject polyfills or other scripts if necessary
  if (line.injectJs && line.injectJs.length > 0) {
    page.onInitialized = function () {
      line.injectJs.forEach(function (path) {
        console.log('Injecting script: ', path);
        page.injectJs(path);
      });
    };
  }

  if (line.maxRenders) maxRenders = line.maxRenders;
  page.viewportSize = {
    width: line.width || 1280,
    height: line.height || 960
  };

  page.paperSize = line.paperSize ||
    {
      format: line.paperFormat || 'A4',
      orientation: line.orientation || 'portrait',
      margin: line.margin || '0cm'
    };

  if (line.userAgent) page.settings.userAgent = line.userAgent;

  if (line.headers) page.customHeaders = line.headers;

  if (line.crop) {
    page.clipRect = {
      width: line.crop.width || page.viewportSize.width,
      height: line.crop.height || page.viewportSize.height,
      top: line.crop.top || 0,
      left: line.crop.left || 0
    }
  }

  var onerror = function() {
    line.success = false;
    console.log(JSON.stringify(line));
    page = null;
    loop();
  }

  page.open(line.url, function(requestStatus) {
    if (requestStatus !== 'success') return onerror();

    var render = function() {
      setTimeout(function() {
        if (line.printMedia) forcePrintMedia();
        page.render(line.filename, {format:line.format || 'png', quality:line.quality || 100});
        page = null;
        line.success = true;
        console.log(JSON.stringify(line));
        if (maxRenders && renders++ >= maxRenders) phantom.exit(0);
        loop();
      }, 0);
    };

    var waitAndRender = function() {
      var timeout = setTimeout(function() {
        page.onAlert('webpage-error');
      }, line.timeout);

      var rendered = false;
      page.onAlert = function(msg) {
        if (msg !== 'webpage-renderable' && msg !== 'webpage-error') return;
        if (rendered) return;
        rendered = true;
        clearTimeout(timeout);

        if (msg === 'webpage-renderable') render();
        else onerror();
      };

      page.evaluate(function(expects) {
        if (window.renderable === expects) return alert('webpage-renderable');
        if (window.renderable) return alert('webpage-error');

        var renderable = false;
        Object.defineProperty(window, 'renderable', {
          get: function() {
            return renderable;
          },
          set: function(val) {
            renderable = val;
            if (renderable === expects) alert('webpage-renderable');
            else alert('webpage-error');
          }
        });
      }, line.expects);
    };

    var renderable = page.evaluate(function() {
      return window.renderable;
    });

    if (renderable === false && !line.expects) line.expects = true;
    if (line.expects === renderable) return render();
    if (line.expects) return waitAndRender();
    render();
  });
};

loop();
