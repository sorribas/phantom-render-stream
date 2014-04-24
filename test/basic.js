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