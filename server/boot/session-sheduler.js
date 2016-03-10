var moment = require('moment');
var shared = require('../socket/shared');
var async = require('async');

module.exports = function(app) {
	var Session = app.models.Session;
	var now = moment.utc().format();

	setInterval(function() {
		var startNsp = app.socketServer.nsps['/startSession'];

		Session.find({
			where: {
				startAt: {lt: now},
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
						shared.updateGroupAndSessAfterFinish(group, session, cb);
					}
				], callback);
			});
		});
	}, 5*60*60*1000);
};