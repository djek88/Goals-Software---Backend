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

	Group.findOne(groupFilter, function(err, group) {
		if (err || !group || !group.NextSession()) return callback('Something went wrong.');
		if (group.NextSession()._facilitatorId ||
			group.NextSession()._participantIds.length) {
			return callback('Session already going!');
		}

		socket.join(roomName);
		socket.broadcast.to(roomName).emit('user:joined', userId);
		callback(null, shared.onlineIdsInRoom(socket.nsp, roomName));

	});
}

function sessionStart(roomName, callback) {
	var socket = this;
	var Group = app.models.Group;
	var onlineUserIds = shared.onlineIdsInRoom(socket.nsp, roomName);
	var isJoinedToRoom = onlineUserIds.indexOf(socket.user._id) >= 0;

	if (!isJoinedToRoom) return callback('You are not joined to room!');

	async.waterfall([
		Group.findById.bind(Group, roomName, {include: 'NextSession'}),
		function(group, cb) {
			var err = isForbidToStart(group);
			if (err) return cb(err);

			// Set facilitator, participantIds
			group.NextSession().updateAttributes({
				_facilitatorId: socket.user._id,
				_participantIds: getParticipantIds(group)
			}, cb);
		}
	], function(err, session) {
		if (err) return callback(err.message);

		callback();
		socket.nsp.to(roomName).emit('startSessionRoom:redirect', session._groupId);
	});

	function isForbidToStart(group) {
		var onlineSess = !group.sessionConf.offline;
		var withoutFacilitator = group.sessionConf.withoutFacilitator;

		if (!group) return new Error('Group not found!');
		if (group.NextSession()._facilitatorId) {
			return new Error('The session is already in progress!');
		}
		if (Date.now() < new Date(group.NextSession().startAt)) {
			return new Error('Session start time is not reached!');
		}
		if (onlineSess && onlineUserIds.length < 2) {
			return new Error('You must have two or more members online to start the session!');
		}
		if (onlineSess && withoutFacilitator && onlineUserIds.length < 3) {
			return new Error('You must have three or more members online to start the session!');
		}
	}

	function getParticipantIds(group) {
		var allUserIds = group._memberIds.concat(group._ownerId);
		var results = group.sessionConf.offline ? allUserIds : onlineUserIds;

		if (group.sessionConf.withoutFacilitator) {
			// exclude facilitator
			results = results.filter(function(id) {
				return id !== socket.user._id;
			});
		}

		return results;
	}
}