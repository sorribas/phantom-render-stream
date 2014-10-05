var stream = require('stream');
var util = require('util');

var BufferStream = function(data) {
  if(!(this instanceof BufferStream)) return new BufferStream(data);

  stream.Readable.call(this);
  this._data = (typeof data === 'string') ? new Buffer(data, 'utf-8') : data;
};

util.inherits(BufferStream, stream.Readable);

BufferStream.prototype._read = function() {
  this.push(this._data);
  this.push(null);
};

module.exports = BufferStream;
