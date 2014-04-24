var webpage = require('webpage');
var server = require('webserver').create();
var system = require('system');
var host, port;

// hackish but works
var getUrl = function(url) {
	var parser = document.createElement('a');
	parser.href = 'http://example.com' + url;

	if (parser.search.indexOf('?url=') !== 0) return false;
	return decodeURIComponent(parser.search.substr(5));
};

var error = function(response) {
	response.statusCode = 500;
	response.close();
};

if (system.args.length !== 2) {
	console.log('Usage: server.js <some port>');
	phantom.exit(1);
} else {
	port = system.args[1];
	var listening = server.listen(port, function (request, response) {
		var format = false;
		if (request.url.indexOf('/png') === 0) format = 'PNG';
		if (request.url.indexOf('/jpeg') === 0) format = 'JPEG';
		if (request.url.indexOf('/pdf') === 0) format = 'PDF';
		if (!format) return error(response);

		var url = getUrl(request.url);

		var page = webpage.create();
		page.viewportSize = {width: 1280, height: 960};

		page.open(url, function(st) {
			if (st !== 'success') return response.close();
			response.statusCode = 200;
			response.headers = {"Cache": "no-cache", "Content-Type": "text/html"};

			var b64 = page.renderBase64('PNG');
			if (b64) {
				response.write(b64);
				return response.close();
			}
			setTimeout(function() {
				b64 = page.renderBase64('PNG');
				response.write(b64);
				response.close();
			}, 0);
		});
	});
	if (!listening) {
		console.log("Could not create web server listening on port " + port);
		phantom.exit();
	} else {
		console.log('Server listening on port ' + port);
	}
}
