var CronJob = require('cron').CronJob;
var shared = require('../socket/shared');
var async = require('async');

module.exports = function(app) {
	var job = new CronJob({
		cronTime: '00 */05 * * * *',
		//cronTime: '*/5 * * * * *', // every 5 sec
		onTick: onTick,
		start: true
	});

	function onTick() {
		checkNotAttendedSessions();
		checkFailedSessions();
	}

	function checkNotAttendedSessions() {
		app.models.Session.find({
			where: {
				startAt: {lt: Date.now()},
				_participantIds: [],
				state: []
			},
			include: 'Group'
		}, function(err, sessions) {
			if (err) return;

			var startNsp = app.socketServer.nsps['/startSession'];

			async.each(sessions, function(session) {
				var roomName = session._groupId;
				var onlineCount = shared.onlineIdsInRoom(startNsp, roomName).length;

				if (!onlineCount) {
					shared.updateGroupAndSessAfterFinish(session.Group(), session);
				}
			});
		});
	}

	function checkFailedSessions() {
		app.models.Session.find({
			where: {
				startAt: {lt: Date.now()},
				_participantIds: {neq: []},
				and: [{state: {neq: []}}, {state: {neq: [-1, -1, -1]}}],
				_facilitatorId: {neq: null}
			},
			include: 'Group'
		}, function(err, sessions) {
			if (err) return;

			var goesNsp = app.socketServer.nsps['/goesSession'];

			async.each(sessions, function(session) {
				var roomName = session._groupId;
				var onlineCount = shared.onlineIdsInRoom(goesNsp, roomName).length;

				if (!onlineCount) {
					shared.updateGroupAndSessAfterFinish(session.Group(), session);
				}
			});
		});
	}
};