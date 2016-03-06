var async = require('async');
var app = require('../server');
var shared = require('./shared');

module.exports = function(io) {
	var startNsp = io.of('/startSession');

	startNsp.on('connection', function(socket) {
		//console.log('user connected to start nsp');

		socket.on('startSessionRoom:join', shared.checkAuthBeforeCall(onJoin));
		socket.on('startSessionRoom:startSession', shared.checkAuthBeforeCall(sessionStart));
		socket.on('disconnect', shared.onDisconnect);

		socket.onclose = shared.onclose;
	});

	return startNsp;
};

function onJoin(roomName, callback) {
	var socket = this;
	var Group = app.models.Group;
	var userId = socket.user._id.toString();
	var groupFilter = {
		where: {
			_id: roomName,
			or: [{_ownerId: userId}, {_memberIds: userId}]
		},
		include: 'NextSession'
	};

	async.waterfall([
		Group.findOne.bind(Group, groupFilter),
		function(group, cb) {
			if (!group) return cb(true);

			group.NextSession.getAsync(cb);
		}
	], function(err, session) {
		if (err || !session || session._facilitatorId) {
			return callback(new Error('Forbidden'));
		}

		socket.join(roomName);
		socket.broadcast.to(roomName).emit('user:joined', userId);
		callback(null, shared.onlineIdsInRoom(socket.nsp, roomName));
	});
}

function sessionStart(roomName) {
	var socket = this;
	var Group = app.models.Group;
	var onlineUserIds = shared.onlineIdsInRoom(socket.nsp, roomName);
	var haveAcess = onlineUserIds.indexOf(socket.user._id.toString()) >= 0;

	if (!haveAcess || onlineUserIds.length < 2) return;

	async.waterfall([
		Group.findById.bind(Group, roomName, {include: 'NextSession'}),
		function(group, cb) {
			if (!group) return cb(true);

			group.NextSession.getAsync(function(err, session) {
				if (err || session._facilitatorId) return cb(true);

				// Set facilitator, participantIds
				session.updateAttributes({
					_facilitatorId: socket.user._id,
					_participantIds: onlineUserIds
				}, cb);
			});
		}
	], function(err, session) {
		if (err) return;
		socket.nsp.to(roomName).emit('startSessionRoom:redirect', session._groupId);
	});
}