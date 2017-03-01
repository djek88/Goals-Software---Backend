var server = require('../server/server.js');

before(function(done) {
	var app = server.start();
	module.exports = require('supertest')('http://localhost:3444');

	setTimeout(function() {
		done();
	}, 50);
});