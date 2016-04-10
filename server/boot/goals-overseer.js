var CronJob = require('cron').CronJob;
var async = require('async');
var mailer = require('../lib/mailer');

module.exports = function(app) {
	var job = new CronJob({
		cronTime: '00 20 * * * *',
		onTick: onTick,
		start: true
	});

	function onTick() {
		app.models.Goal.find({
			where: {
				dueDate: {lt: Date.now()},
				state: {inq: [1, 2, 4]}
			},
			include: 'Group'
		}, function(err, goals) {
			if (err) return;

			async.each(goals, function(goal, callback) {
				if (goal.state === 1) {
					updateGoal(goal, 5);
					return callback();
				}

				goal.Group.getAsync(function(err, group) {
					if (err || !group) return callback();

					var voterIds = group._memberIds
						.concat(group._ownerId)
						.filter(function(id) {return id !== goal._ownerId});
					var whoNotVoteIds = [].concat(voterIds);
					var groupOwnerVote = null;
					var approveVotes = 0;
					var rejectVotes = 0;
					var newState = null;

					goal.votes.forEach(function(vote) {
						// consider only current group members votes
						if (voterIds.some(function(id) {return id === vote._approverId})) {
							if (vote.approved) {
								approveVotes++;
							} else {
								rejectVotes++;
							}

							// save groupOwner vote
							if (group._ownerId === vote._approverId) {
								groupOwnerVote = vote.approved;
							}

							// calculate the members who not had vote
							whoNotVoteIds = whoNotVoteIds.filter(function(id) {
								return id !== vote._approverId;
							});
						}
					});

					approveVotes = approveVotes / voterIds.length * 100;
					rejectVotes = rejectVotes / voterIds.length * 100;


					if (approveVotes === 50 && rejectVotes === 50 && groupOwnerVote !== null) {
						newState = groupOwnerVote ? 3 : 5;
					} else if (rejectVotes > 50) {
						newState = 5;
					} else if (approveVotes > 50) {
						newState = 3;
					} else {
						/*mailer.notifyById(
							whoNotVoteIds,
							'Need you vote',
							[
								'You are not had vote for this goal: "app.themastermind.nz/group/' + goal._groupId + '/goal-review/' + goal._id + '".',
								'Please review this goal and leave your vote.'
							].join('\r')
						);*/
					}

					if (newState !== null) {
						updateGoal(goal, newState);
					}

					callback();
				});
			});
		});
	}

	function updateGoal(goal, newState) {
		goal.updateAttributes({state: newState}, function() {
			// doing anithing
		});
	}
};