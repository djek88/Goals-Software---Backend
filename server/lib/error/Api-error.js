var util = require('util');
var http = require('http');

module.exports = ApiError;

// Api Error for request
function ApiError(status, message) {
	Error.apply(this, arguments);
	Error.captureStackTrace(this, ApiError);

	this.status = status;
	this.message = message || http.STATUS_CODES[status] || 'Unknown';
	console.log(this);
}

util.inherits(ApiError, Error);

ApiError.prototype.name = 'ApiError';

ApiError.incorrectParam = function(param) {
	return new ApiError(400, 'Incorrect \'' + param + '\' parameter');
};