var webpage = require('webpage');
var system = require('system');
var fs = require('fs');
 
var page = webpage.create();
 
var filename = system.args[1];

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

var loop = function() {
	var line = JSON.parse(system.stdin.readLine());

	if (!page) page = webpage.create();

	page.viewportSize = {
		width: line.width || 1280,
		height: line.height || 960
	};

	page.paperSize = {
		format: line.paperFormat || 'A4',
		orientation: line.orientation || 'portrait',
		margin: line.margin || '0cm'
	};

	if (line.crop) page.clipRect = page.viewportSize;

	page.open(line.url, function(st) {
		if (st !== 'success') {
			fs.write(filename, '!', 'w');
			page = null;
			loop();
			return;
		}

		var render = function() {
			setTimeout(function() {
				if (line.printMedia) forcePrintMedia();
				page.render(filename, {format:line.format || 'png'});
				loop();
			}, 0);
		};

		var waitAndRender = function() {
			page.evaluate(function() {
				var renderable = false;
				Object.defineProperty(window, 'renderable', {
					get: function() {
						return renderable;
					},
					set: function(val) {
						renderable = val;
						alert('webpage-renderable');
					}
				});
			});

			page.onAlert = function(msg) {
				if (msg === 'webpage-renderable') render();
			};
		};

		var renderable = page.evaluate(function() {
			return window.renderable;
		});
		if (renderable === false) return waitAndRender();
		render();

	});
};
 
loop();
