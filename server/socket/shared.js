var async = require('async');
var app = require('../server');
var createSession = require('../../common/models/group/group').createSession;
var mailer = require('../lib/mailer');

module.exports = {
	updateGroupAndSessAfterFinish: updateGroupAndSessAfterFinish,
	checkAuthBeforeCall: checkAuthBeforeCall,
	onlineIdsInRoom: onlineIdsInRoom,
	onclose: onclose,
	onDisconnect: onDisconnect
};

function updateGroupAndSessAfterFinish(group, session, callback) {
	// have bug, if couple sockets (users) at the same time disconnected,
	// than this function call once or twice, hence couple once created new session.
	if (group._lastSessionId && group._lastSessionId.toString() === session._id.toString()) {
		return callback();
	}

	async.series([
		session.updateAttributes.bind(session, {state: [-1, -1, -1]}),
		function(cb) {
			if (!group.sessionConf.sheduled) {
				group.updateAttributes({
					_nextSessionId: null,
					_lastSessionId: session._id
				}, cb);
			} else {
				createSession(group, function(err, newSess) {
					if (err) return cb(err);
					if (!newSess) return cb(new Error());

					group.updateAttributes({
						_nextSessionId: newSess._id,
						_lastSessionId: session._id
					}, cb);
				});
			}
		},
		applyPenaltyForUsers.bind(null, group, session)
	], callback);
}

function applyPenaltyForUsers(group, session, callback) {
	var whoWillPayPenaltyIds = whoMissedSessionWithoutValidExcuse();

	app.models.Customer.find({
		where: {_id: {inq: whoWillPayPenaltyIds}}
	}, function(err, members) {
		if (err || !members) return callback();

		callback();

		members.forEach(function(member) {
			mailer.notifyByEmail(
				member.email,
				'You now owe a penalty...',
				[
					'Hi ' + member.firstName + '\r\r',

					'Looks like you failed to turn up to the last mastermind session.\r\r',

					group.penalty > 0 ? 'You need to pay the group penalty amount of $' + group.penalty + ' to remain a member.\r\r' : '',

					'Better luck next time!\r\r'
				].join('')
			);
		});
	});

	function whoMissedSessionWithoutValidExcuse() {
		var memberIds = group._memberIds.concat(group._ownerId);
		var whoMissedIds = memberIds.filter(function(mId) {
			return !session._participantIds.some(function(pId) {return pId === mId;});
		});

		return whoMissedIds.filter(isInvalidExcuse);

		function isInvalidExcuse(id) {
			if (!session.excuses[id] || !session.excuses[id]._votes.length) return true;

			// consider only current members votes
			var activeVotesCount = session.excuses[id]._votes.filter(function(voterId) {
				return memberIds.some(function(id) {return id === voterId;});
			}).length;

			if (!activeVotesCount) return true;

			var approveVotesPercent = ((activeVotesCount / (memberIds.length - 1)) * 100).toFixed();
			return approveVotesPercent <= 50;
		}
	}
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