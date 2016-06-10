var CronJob = require('cron').CronJob;
var async = require('async');
var mailer = require('../lib/mailer');

module.exports = function(app) {
	var job = new CronJob({
		cronTime: '00 */05 * * * *',
		//cronTime: '*/10 * * * * *', // every 10 sec
		onTick: onTick,
		start: true
	});

	function onTick() {
		app.models.Goal.find({
			where: {
				state: {inq: [1, 2, 4]}
			},
			include: 'Group'
		}, function(err, goals) {
			if (err) return;

			async.each(goals, function(goal, callback) {
				if (goal.state === 1 && goal.dueDate < Date.now()) {
					updateGoal(goal, goal.Group(), 5);
					return callback();
				}

				var newState = getNewGoalState(goal, goal.Group());
				var isDueDateReached = goal.dueDate < Date.now();

				// also can change goal state to "reached",
				// if already have more of 50% positive votes
				if (isDueDateReached && newState !== null ||
					!isDueDateReached && newState === 3) {

					updateGoal(goal, goal.Group(), newState);
				}

				callback();

				function getNewGoalState() {
					var voterIds = goal.Group()._memberIds.concat(goal.Group()._ownerId)
						.filter(function(id) {return id !== goal._ownerId;});
					var whoNotVoteIds = [].concat(voterIds);
					var groupOwnerVote = null;
					var approveVotes = 0;
					var rejectVotes = 0;

					// counting approveVotes, rejectVotes, whoNotVoteIds, groupOwnerVote
					goal.votes.forEach(function(vote) {
						// consider only current group members votes
						if (voterIds.some(function(id) {return id === vote._approverId;})) {
							if (vote.approved) {
								approveVotes++;
							} else {
								rejectVotes++;
							}

							// save groupOwner vote
							if (goal.Group()._ownerId === vote._approverId) {
								groupOwnerVote = vote.approved;
							}

							// recalculate the members who not had vote
							whoNotVoteIds = whoNotVoteIds.filter(function(id) {
								return id !== vote._approverId;
							});
						}
					});

					approveVotes = approveVotes / voterIds.length * 100;
					rejectVotes = rejectVotes / voterIds.length * 100;

					if (approveVotes === 50 && rejectVotes === 50 && groupOwnerVote !== null) {
						return groupOwnerVote ? 3 : 5;
					} else if (rejectVotes > 50) {
						return 5;
					} else if (approveVotes > 50) {
						return 3;
					} else {
						return null;
						// if whoNotVoteIds.length != 0 we can notify by email,
						// those members who didn't leave vote yet

						/*mailer.notifyById(
							whoNotVoteIds,
							'Need you vote',
							[
								'You are not had vote for this goal: "app.themastermind.nz/group/' + goal._groupId + '/goal-review/' + goal._id + '".',
								'Please review this goal and leave your vote.'
							].join('\r')
						);*/
					}
				}
			});
		});
	}

	function updateGoal(goal, group, newState) {
		goal.updateAttributes({state: newState}, function(err, freshGoal) {
			if (freshGoal.state === 5) {
				notifyGoalOwnerAboutPenalty(freshGoal, group);
			}
		});
	}

	function notifyGoalOwnerAboutPenalty(goal, group) {
		app.models.Customer.findById(goal._ownerId, function(err, owner) {
			if (err || !owner) return;

			mailer.notifyByEmail(
				owner.email,
				'You now owe a penalty...',
				[
					'Hi ' + owner.firstName + '\r\r',

					'Looks like you failed to achieve your goal on time.\r\r',

					group.penalty > 0 ? 'You need to pay the group penalty amount of $' + group.penalty + ' to remain a member.\r\r' : '',

					'Better luck next time!\r\r'
				].join('')
			);
		});
	}
};