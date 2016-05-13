var async = require('async');
var app = require('../server');
var createSession = require('../../common/models/group/group').createSession;

module.exports = {
	updateGroupAndSessAfterFinish: updateGroupAndSessAfterFinish,
	checkAuthBeforeCall: checkAuthBeforeCall,
	onlineIdsInRoom: onlineIdsInRoom,
	onclose: onclose,
	onDisconnect: onDisconnect
};

function updateGroupAndSessAfterFinish(group, session, callback) {
	// have bug, if couple sockets (users) at the same time disconnected
	// this funcion call once or twice, hence couple once create new session.
	if (group._lastSessionId && group._lastSessionId.toString() === session._id.toString()) {
		return callback();
	}
	
	async.series([
		session.updateAttributes.bind(session, {state: [-1, -1, -1]}),
		function(cb) {
			if (!group.sessionConf.sheduled) {
				return group.updateAttributes({
					_nextSessionId: null,
					_lastSessionId: session._id
				}, cb);
			}

			createSession(group, function(err, newSess) {
				if (err) return cb(err);
				if (!newSess) return cb(new Error());

				group.updateAttributes({
					_nextSessionId: newSess._id,
					_lastSessionId: session._id
				}, cb);
			});
		}
	], callback);
}

function checkAuthBeforeCall(handler) {
	return function() {
		if (this.auth) handler.apply(this, arguments);
	};
}

function onlineIdsInRoom(nsp, roomName) {
	if (!nsp.adapter.rooms[roomName]) return [];

	var socketIds = nsp.adapter.rooms[roomName].sockets;
	var userIds = [];

	for(var id in socketIds) {
		userIds.push(nsp.connected[id].user._id.toString());
	}

	return userIds;
}

function onclose(reason) {
	var socket = this;

	if (socket.auth) {
		for (var room in socket.rooms) {
			socket.broadcast.to(room).emit('user:left', socket.user._id);
		}
	}

	Object.getPrototypeOf(socket).onclose.call(socket, reason);
}

function onDisconnect() {
	//console.log('user disconnected from goes nsp');
}