var CronJob = require('cron').CronJob;
var async = require('async');
var mailer = require('../lib/mailer');

module.exports = function(app) {
	var job = new CronJob({
		cronTime: '30 * * * * *',
		//cronTime: '*/01 * * * * *', // every second
		onTick: onTick,
		start: true
	});

	function onTick() {
		app.models.Session.find({
			where: {
				startAt: {gt: Date.now()},
			},
			include: 'Group'
		}, function(err, sessions) {
			if (err) return;

			async.each(sessions, function(session) {
				var minLeft = parseInt((session.startAt - Date.now()) / 1000 / 60, 10);

				if (minLeft !== 60 && minLeft !== 5) return;

				var memberIds = session.Group()._memberIds.concat(session.Group()._ownerId);

				app.models.Customer.find({where: {_id: {inq: memberIds}}}, function(err, members) {
					if (err) return;

					members.forEach(function(member) {
						var message = [
							'Hi ' + member.firstName + '\r\r',

							'Just a quick reminder that your group will be meeting in ' + (minLeft === 60 ? '1 hr' : '5 mins') + '.\r\r',

							(session.Group().offlineSessions ? '' : [
								'If you can\'t make it, remember to make your excuse before the meeting begins.\r\r',

								minLeft === 5 ? 'To join the meeting click the link below:\r\rapp.themastermind.nz/session/' + session._groupId + '/start\r\r': ''
							].join('')),

							'Growing together,\rThe Mastermind Team'
						].join('');

						mailer.notifyByEmail(
							member.email,
							'Your mastermind group are meeting in ' + (minLeft === 60 ? '1 hr' : '5 mins'),
							message
						);
					});
				});
			});
		});
	}
};