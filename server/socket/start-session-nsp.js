var moment = require('moment');
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
		if (err || !session) return callback('Something went wrong.');
		if (session._facilitatorId || 
			session._participantIds.length) return callback('Session already going!');

		socket.join(roomName);
		socket.broadcast.to(roomName).emit('user:joined', userId);
		callback(null, shared.onlineIdsInRoom(socket.nsp, roomName));
	});
}

function sessionStart(roomName, callback) {
	var socket = this;
	var Group = app.models.Group;
	var onlineUserIds = shared.onlineIdsInRoom(socket.nsp, roomName);
	var isJoinedToRoom = onlineUserIds.indexOf(socket.user._id.toString()) >= 0;

	if (!isJoinedToRoom) return callback('You are not joined to room!');
	if (onlineUserIds.length < 2) return callback('You must have two or more members online to start the session!');

	async.waterfall([
		Group.findById.bind(Group, roomName, {include: 'NextSession'}),
		function(group, cb) {
			if (!group) return cb(new Error('Group not found!'));

			group.NextSession.getAsync(function(err, session) {
				if (err) return cb(err);
				if (session._facilitatorId) return cb(new Error('The session is already in progress!'));
				if (Date.now() < new Date(session.startAt)) return cb(new Error('Session start time is not reached!'));

				// Set facilitator, participantIds
				session.updateAttributes({
					_facilitatorId: socket.user._id,
					_participantIds: onlineUserIds
				}, cb);
			});
		}
	], function(err, session) {
		if (err) return callback(err.message);
		callback(null, session._groupId);
	});
}