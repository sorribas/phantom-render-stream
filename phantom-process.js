// Code to be run by PhantomJS.
// The docs for these modules are here: http://phantomjs.org/api/
// Note that the 'fs' module here has a different API than the one in node.js core.
var webpage = require('webpage');
var system = require('system');

var page = createWebPage();

function createWebPage (id) {
  var page = webpage.create();
  page.id = id;

  page.log = function(message) {
    var json = JSON.stringify({
      id: page.id,
      log: message
    });
    console.log(json);
  }

  page.onConsoleMessage = function (msg, lineNum, sourceId) {
    page.log({
      type: 'consoleMessage',
      data: {
        msg: msg,
        lineNum: lineNum,
        sourceId: sourceId
      }
    });
  };

  page.onError = function (msg, trace) {
    page.log({
      type: 'error',
      data: {
        msg: msg,
        trace: trace
      }
    });
  };

  page.onResourceError = function (resourceError) {
    page.log({
      type: 'resourceError',
      data: {
        resourceError: resourceError
      }
    });
  };

  page.onResourceTimeout = function(request) {
    page.log({
      type: 'resourceTimeout',
      data: {
        request: request
      }
    });
  };

  return page;
}


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

  if (!page) page = createWebPage(line.id);
  else page.id = line.id;

  if (line.cookies && line.cookies.length > 0) {
    line.cookies.forEach(function (c) {
      phantom.addCookie(c);
    });
  }

  // inject polyfills or other scripts if necessary
  if (line.injectJs && line.injectJs.length > 0) {
    page.onInitialized = function () {
      line.injectJs.forEach(function (path) {
        page.log({
          type: 'injectedScript',
          data: {path: path}
        });
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

  if (line.zoomFactor) page.zoomFactor = line.zoomFactor;

  if (line.dpi) page.settings.dpi = line.dpi;

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

  if(line.javascriptEnabled === false) page.settings.javascriptEnabled = false;

  page.onResourceRequested = function(requestData, networkRequest) {
      var newUrl = requestData.url.replace(/\/lm\//, "/");
      if (newUrl != requestData.url) {
	  console.log(requestData.method + " " + newUrl);
      }
      networkRequest.changeUrl(newUrl);
  };

  var onerror = function(message) {
    page.log(message);
    line.success = false;
    console.log(JSON.stringify(line));
    page = null;
    loop();
  }

  page.open(line.url, function(requestStatus) {
    if (requestStatus !== 'success') return onerror({
      type: 'pageFetchError',
      data: {status: requestStatus}
    });

    page.paperSize = line.paperSize || {
      format: line.paperFormat || 'A4',
      orientation: line.orientation || 'portrait',
      margin: line.margin || '0cm',
      width: '8.5in',
      height: '11in',
      header: {},
      footer: {}
    }

    /* A PhantomJSPrinting object in the rendered page will determine the header/footer */
    if (page.evaluate(function(){return typeof PhantomJSPrinting == "object";})) {
      var paperSize = page.paperSize;
      paperSize.header.height = page.evaluate(function() {
        return PhantomJSPrinting.header.height;
      });
      paperSize.header.contents = phantom.callback(function(pageNum, numPages) {
        return page.evaluate(function(pageNum, numPages){return PhantomJSPrinting.header.contents(pageNum, numPages);}, pageNum, numPages);
      });
      paperSize.footer.height = page.evaluate(function() {
        return PhantomJSPrinting.footer.height;
      });
      paperSize.footer.contents = phantom.callback(function(pageNum, numPages) {
        return page.evaluate(function(pageNum, numPages){return PhantomJSPrinting.footer.contents(pageNum, numPages);}, pageNum, numPages);
      });
      page.paperSize = paperSize;
    }

    var render = function() {
      setTimeout(function() {
        if (line.printMedia) forcePrintMedia();
        page.render(line.filename, {format:line.format || 'png', quality:line.quality || 100});
        page = null;
        line.success = true;
        console.log(JSON.stringify(line));
        if (maxRenders && renders++ >= maxRenders) return phantom.exit(0);
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
        else onerror({
          type: 'expectError',
          data: {expects: line.expects}
        });
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
