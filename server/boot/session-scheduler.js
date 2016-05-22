var CronJob = require('cron').CronJob;
var shared = require('../socket/shared');
var async = require('async');

module.exports = function(app) {
	if (!app.socketServer) return;

	var job = new CronJob({
		cronTime: '00 */05 * * * *',
		//cronTime: '*/10 * * * * *', // every 10 sec
		onTick: onTick,
		start: true
	});

	function onTick() {
		var startNsp = app.socketServer.nsps['/startSession'];

		app.models.Session.find({
			where: {
				startAt: {lt: Date.now()},
				_participantIds: [],
				state: []
			},
			include: 'Group'
		}, function(err, sessions) {
			if (err) return;

			async.each(sessions, function(session, callback) {
				var roomName = session._groupId;
				var onlineCount = shared.onlineIdsInRoom(startNsp, roomName).length;

				if (onlineCount) return callback();

				async.waterfall([
					session.Group.getAsync.bind(session),
					function(group, cb) {
						if (!group) return cb();

						shared.updateGroupAndSessAfterFinish(group, session, cb);
					}
				], callback);
			});
		});
	}
};