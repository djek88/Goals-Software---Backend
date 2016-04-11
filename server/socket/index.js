var socketAuth = require('socketio-auth');
var async = require('async');
var app = require('../server');

module.exports = Socket;

function Socket(server) {
	var io = require('socket.io')(server, {path: '/sockets'});

	var startNsp = require('./start-session-nsp')(io);
	var goesNsp = require('./goes-session-nsp')(io);

	socketAuth(startNsp, {authenticate: authenticate});
	socketAuth(goesNsp, {authenticate: authenticate});

	return io;
}

function authenticate(socket, data, cb) {
	var AccessToken = app.models.AccessToken;
	var Customer = app.models.Customer;

	async.parallel([
		AccessToken.findById.bind(AccessToken, data.id),
		Customer.findById.bind(Customer, data.userId)
	], function(err, results) {
		if (err || !results[0] || !results[1]) return cb(null, false);

		socket.user = results[1];
		cb(null, true);
	});
}