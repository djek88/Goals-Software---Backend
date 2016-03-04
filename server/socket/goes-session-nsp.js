var async = require('async');
var app = require('../server');
var shared = require('./shared');
var Timer = require('../lib/session-timer');

module.exports = function(io) {
	var goesNsp = io.of('/goesSession');

	goesNsp.on('connection', function(socket) {
		//console.log('user connected to goes nsp');

		socket.on('goesSessionRoom:join', shared.checkAuthBeforeCall(goesSessionOnJoin));
		socket.on('goesSessionRoom:skipRound', shared.checkAuthBeforeCall(onSkipRound));
		socket.on('goesSessionRoom:pauseResume', shared.checkAuthBeforeCall(onPauseResume));
		socket.on('disconnect', shared.onDisconnect);

		socket.onclose = skipRoundWhenUserLeave.bind(socket);
	});

	return goesNsp;
};

function goesSessionOnJoin(roomName, callback) {
	var socket = this;
	var nsp = socket.nsp;
	var userId = socket.user._id.toString();

	// Forbidden connect if session already going
	if (nsp.adapter.rooms[roomName] && nsp.adapter.rooms[roomName].state) {
		return callback(new Error('Forbidden'));
	}

	async.waterfall([
		getGroupByFilter.bind(null, roomName, userId),
		getNextSessionByGroup
	], function (err, group, session) {
		if (err || isJoinForbidden(session, group)) {
			return callback(new Error('Forbidden'));
		}

		socket.join(roomName);
		callback(null, session._facilitatorId);

		if (isAllParticipantsJoin(session)) {
			turnToNextState(nsp, roomName, session, group);
		}
	});

	function isJoinForbidden(session, group) {
		var participantIds = session._participantIds;
		var sessFinish = session.state.length;
		var isRoundsValid = returnNextState(
			session.state, group, participantIds.length
		);
		var haveAccess = participantIds.some(function(id) {
			return id.toString() === userId;
		});

		return (!session._facilitatorId || sessFinish ||
			!haveAccess || !isRoundsValid);
	}

	function isAllParticipantsJoin(session) {
		var connectedCount = shared.onlineIdsInRoom(nsp, roomName).length;
		var participantsCount = session._participantIds.length;

		return connectedCount === participantsCount;
	}
}

function onSkipRound(roomName) {
	var room = this.nsp.adapter.rooms[roomName];

	if (room && room.timer && room.facilitatorId &&
		room.facilitatorId === this.user._id.toString()) {
		room.timer.finish();
	}
}

function onPauseResume(roomName) {
	var room = this.nsp.adapter.rooms[roomName];

	if (!room || !room.timer || !room.facilitatorId ||
		room.facilitatorId !== this.user._id.toString()) {
		return;
	}

	if (room.timer.isPause) return room.timer.resume();

	room.timer.pause();
}

function skipRoundWhenUserLeave(reason) {
	var socket = this;

	if (!socket.auth) return shared.onclose.call(socket, reason);

	var id = socket.user._id.toString();

	for (var roomName in socket.rooms) {
		var room = socket.nsp.adapter.rooms[roomName];

		if (room.timer && room.state && room.participantIds) {
			var onlineIds = shared.onlineIdsInRoom(socket.nsp, roomName);
			var remainsOneUser = onlineIds.length <= 2;
			var userNumWhoLeave = room.participantIds.indexOf(id) + 1;
			var userNumWhoseTurn = room.state[2] ? room.state[2] : room.state[1];

			if (userNumWhoLeave === userNumWhoseTurn || remainsOneUser) {
				setTimeout(room.timer.finish, 1000);
			}
		}
	}

	shared.onclose.call(socket, reason);
}

function turnToNextState(nsp, roomName, session, group) {
	var onlineIds = shared.onlineIdsInRoom(nsp, roomName);
	var state = getNextSessionStateByOnlineList(session, group, onlineIds);
	var room = nsp.adapter.rooms[roomName];
	var isSessionFinish = !state;

	//console.log('cur state', session.state);
	//console.log('next state', state);

	if (isSessionFinish) {
		// Clear room obj
		if (room) {
			delete room.timer;
			delete room.state;
			delete room.participantIds;
			delete room.facilitatorId;
		}

		state = [-1, -1, -1];
	}

	safelyUpdateSessionState(session, state, function(err, freshSess) {
		if (err) return nsp.to(roomName).emit('session:stateUpdate', err);

		if (isSessionFinish) {
			//console.log('session finish');
			return nsp.to(roomName).emit('session:stateUpdate', null, null);
		}

		var curState = freshSess.state;
		var sendingData = {
			state: curState,
			focusOn: freshSess._participantIds[curState[1] - 1],
			whoGiveFeedback: curState[2] ? freshSess._participantIds[curState[2] - 1] : null
		};
		var nextTurnInfo = getNextTurnInfo(freshSess, group, onlineIds);
		var curStateSec = getTimeForCurState(freshSess, group);
		var timer = new Timer(curStateSec);

		nsp.to(roomName).emit('session:stateUpdate', null, sendingData);
		nsp.to(roomName).emit('session:nextTurnInfo', nextTurnInfo);

		// Save in room obj necessary info
		room.timer = timer;
		room.state = curState;
		room.facilitatorId = freshSess._facilitatorId.toString();
		room.participantIds = freshSess._participantIds.map(function(id) {return id.toString()});


		timer.onUpdate = function(sec) {
			//console.log('update', sec);
			nsp.to(roomName).emit('session:timerUpdate', sec);
		};

		timer.onFinish = function() {
			//console.log('round finish');
			turnToNextState(nsp, roomName, freshSess, group);
		}
	});
}

function getNextSessionStateByOnlineList(session, group, onlineIds) {
	if (onlineIds.length < 2) return null;

	var participantIds = session._participantIds;
	var state = session.state;

	while (true) {
		state = returnNextState(state, group, participantIds.length);
		if (!state) return state;

		var whoseTurnToTalkId = participantIds[state[1] - 1].toString();

		if (onlineIds.indexOf(whoseTurnToTalkId) < 0) continue;

		if (state[2]) {
			whoseTurnToTalkId = participantIds[state[2] - 1].toString();

			if (onlineIds.indexOf(whoseTurnToTalkId) < 0) continue;
		}

		break;
	}

	return state;
}

function getNextTurnInfo(session, group, onlineIds) {
	var nextState = getNextSessionStateByOnlineList.apply(null, arguments);
	var participantIds = session._participantIds
	var result = {};

	if (nextState) {
		result.nextFocusOn = participantIds[nextState[1] - 1];
		result.nextWhoGiveFeedback = nextState[2] ? participantIds[nextState[2] - 1] : null;

		// due to the next state increment feedback turn, eg 2.1.2++
		var curFocusOn = participantIds[session.state[1] - 1];
		while (curFocusOn === result.nextFocusOn) {
			var tempSession = JSON.parse(JSON.stringify(session));
			tempSession.state = nextState;

			nextState = getNextSessionStateByOnlineList(tempSession, group, onlineIds);

			result.nextFocusOn = nextState ? participantIds[nextState[1] - 1] : null;
		}
	} else {
		result.nextFocusOn = null;
		result.nextWhoGiveFeedback = null;
	}

	return result;
}

function safelyUpdateSessionState(session, state, cb) {
	var attemptCount = 10;

	update();

	function update() {
		session.updateAttributes({
			state: state
		}, function(err, freshSess) {
			attemptCount--;

			if (err && attemptCount) return update();

			cb(err, freshSess);
		});
	}
}

function getTimeForCurState(session, group) {
	var roundLength = group.sessionConf.roundLength.slice();

	if (session.state[2]) return roundLength[2];

	roundLength.splice(2, 1);
	return roundLength[session.state[0] - 1];
}

function returnNextState(state, group, participantsCount) {
	state = state.length ? state.slice() : [0, 0, 0];

	// 1 and 3 round
	if (state[0] === 1 || state[0] === 3) {
		state[1] = getNextParticipant(state[1], participantsCount);

		if (!state[1]) {
			turnToNextRound();
		}
	}
	// 2 round
	else if (state[0] === 2) {
		var isExistSubRound = group.sessionConf.roundLength[2] > 10;

		state[2] = getNextParticipant(state[2], participantsCount, state[1]);

		if (!state[2] || !isExistSubRound) {
			state[1] = getNextParticipant(state[1], participantsCount);
			state[2] = 0;

			if (!state[1]) {
				turnToNextRound();
			}
		}
	}
	// state is empty
	else {
		turnToNextRound();
	}

	return state[0] ? state : null;

	function turnToNextRound() {
		state[0] = getNextRound(state[0], group);
		state[1] = getNextParticipant(0, participantsCount);
	}
}

function getNextParticipant(current, total, whichNeedSkip) {
	whichNeedSkip = whichNeedSkip || -1;
	current++;

	if (current === whichNeedSkip) current++;
	if (current > total) return null;

	return current;
}

function getNextRound(current, group) {
	var roundsLength = group.sessionConf.roundLength.slice();
	roundsLength.splice(2, 1);

	for (var i = current; i < roundsLength.length; i++) {
		if (roundsLength[i] > 10) return i + 1;
	}
	return null;
}

function getGroupByFilter(groupId, userId, cb) {
	app.models.Group.findOne({
		where: {
			_id: groupId,
			or: [{_ownerId: userId}, {_memberIds: userId}]
		}
	}, function(err, group) {
		if (err || !group) return cb(true);
		cb(null, group);
	});
}

function getNextSessionByGroup(group, cb) {
	app.models.Session.findById(group._nextSessionId, function(err, session) {
		if (err || !session) return cb(true);
		cb(null, group, session);
	});
}