var async = require('async');
var ApiError = require('../../../server/lib/error/Api-error');
var mailer = require('../../../server/lib/mailer');
var GOALSTATES = require('../additional/resources').goalStates;
var SUPPORTEDEVIDENCETYPES = require('../additional/resources').supportedEvidenceTypes;
var isOwnerOrMember = require('../group/group').isOwnerOrMember;
var changeModelByWhiteList = require('../group/group').changeModelByWhiteList;

module.exports = function(Goal) {
	Goal.validatesPresenceOf('_ownerId', '_groupId');
	Goal.validatesInclusionOf('state', {in: GOALSTATES});
	Goal.validate('dueDate', function(err) { 
		if (this.state === 1 && new Date(this.dueDate) <= Date.now()) err();
	});

	// Disable unnecessary methods
	Goal.disableRemoteMethod('upsert', true);
	Goal.disableRemoteMethod('deleteById', true);
	Goal.disableRemoteMethod('exists', true);
	Goal.disableRemoteMethod('createChangeStream', true);

	// Leave feedback
	Goal.remoteMethod('leaveFeedback', {
		isStatic: false,
		description: 'Leave feedback for goal.',
		http: {path: '/leave-feedback', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'feedback', type: 'string', description: 'Feedback', required: true}
		],
		returns: {type: 'object', root: true}
	});
	// Notify group members that goal was achieved
	Goal.remoteMethod('notifyGroupMembers', {
		isStatic: false,
		description: 'Notify the other group members that this goal is complete and the evidence is ready for inspection.',
		http: {path: '/notify-group-members', verb: 'get'}
	});
	// Upload evidence files
	Goal.remoteMethod('uploadEvidence', {
		isStatic: false,
		description: 'Upload goal evidence file.',
		http: {path: '/upload-evidence', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'res', type: 'object', 'http': {source: 'res'}}
		],
		returns: {type: 'object', root: true}
	});
	// Remove evidence files
	Goal.remoteMethod('removeEvidence', {
		isStatic: false,
		description: 'Remove goal evidence file.',
		http: {path: '/remove-evidence', verb: 'post'},
		accepts: [
			{arg: 'fileName', type: 'string', description: 'File name', required: true}
		],
		returns: {type: 'object', root: true}
	});
	// Leave feedback
	Goal.remoteMethod('leaveVote', {
		isStatic: false,
		description: 'Leave vote for goal.',
		http: {path: '/leave-vote', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'achieve', type: 'boolean', description: 'Goal is reached', required: true},
			{arg: 'comment', type: 'string', description: 'Your comment'}
		],
		returns: {type: 'object', root: true}
	});

	Goal.prototype.leaveFeedback = function(req, feedback, next) {
		var senderId = req.accessToken.userId;
		var goal = this;

		if (!feedback) return next(ApiError.incorrectParam('feedback'));

		isHaveAcessToGoal(senderId, goal, function(err) {
			if (err) return next(err);

			goal.feedbacks.push({
				_id: senderId,
				feedback: feedback
			});

			goal.updateAttributes({feedbacks: goal.feedbacks}, function(err, freshGoal) {
				if (err) return next(err);

				next(null, freshGoal);

				Goal.app.models.Customer.find({
					where: {_id: {inq: [senderId, freshGoal._ownerId]}}
				}, function(err, members) {
					if (err || members.length !== 2) return;

					var owner = members.filter(function(m) { return m._id === freshGoal._ownerId })[0];
					var sender = members.filter(function(m) { return m._id === senderId })[0];

					mailer.notifyByEmail(
						owner.email,
						sender.firstName + ' just left feedback on your goal',
						[
							'Hi ' + owner.firstName,

							sender.firstName + ' has just left feedback on your goal. The said:',

							feedback,

							'To read it online or respond click the link below:',

							'app.themastermind.nz/group/' + freshGoal._groupId + '/upload-goal-evidence/' + freshGoal._id
						].join('\r\r')
					);
				});
			});
		});
	};

	Goal.prototype.notifyGroupMembers = function(next) {
		var goal = this;

		if (Date.now() >= new Date(goal.dueDate)) {
			return next(new ApiError(403, 'Goal due date has been expired!'));
		}

		goal.updateAttributes({state: 2}, function(err, freshGoal) {
			if (err) return next(err);

			Goal.app.models.Group.findById(freshGoal._groupId, function(err, group) {
				if (err) return next(err);
				if (!group) return next(new ApiError(404, 'Goal group not found!'));
				// if group don't have any members exept goal owner
				if (group._ownerId === freshGoal._ownerId && !group._memberIds.length) {
					return next(new ApiError(404, 'Changes saved success, but no one to notify!'));
				}

				Goal.app.models.Customer.find({
					where: {_id: {inq: group._memberIds.concat(group._ownerId)}}
				}, function(err, customers) {
					if (err) return next(err);
					if (!customers.length) return next(new ApiError(404, 'Customers not found!'));

					var goalOwner = customers.filter(function(m) {return m._id === freshGoal._ownerId;})[0];
					var recipients = customers.filter(function(m) { return m._id !== freshGoal._ownerId;});

					async.each(recipients, function(recipient, callback) {
						mailer.notifyByEmail(
							recipient.email,
							goalOwner.firstName + ' has completed his goal (please review)',
							[
								'Hi ' + recipient.firstName + '\r\r',
								goalOwner.firstName + ' ' + goalOwner.lastName + ' has marked their goal as completed. ',
								'Please click on the link below to review and accept or reject their goal as complete:\r\r',

								'app.themastermind.nz/group/' + freshGoal._groupId + '/goal-review/' + freshGoal._id + '\r\r',

								'You can also check out the status of all ' + goalOwner.firstName + 's goals at:\r\r',

								'app.themastermind.nz/group/' + freshGoal._groupId + '/member-goals/' + freshGoal._ownerId
							].join(''),
							callback
						);
					}, next);
				});
			});
		});
	};

	Goal.prototype.uploadEvidence = function(req, res, next) {
		var Container = Goal.app.models.FilesContainer;
		var goal = this;
		var goalId = goal._id.toString();

		Container.getContainers(function (err, containers) {
			if (err) return next(err);

			if (containers.some(function(c) { return c.name === goalId; })) {
				return uploadFile();
			}

			Container.createContainer({ name: goalId }, function(err, c) {
				if (err) return next(err);
				uploadFile();
			});
		});

		function uploadFile() {
			var supportTypes = [];
			for(var key in SUPPORTEDEVIDENCETYPES) {
				supportTypes.push(SUPPORTEDEVIDENCETYPES[key]);
			}

			var options = {
				container: goalId,
				getFilename: function(file) {
					var fileName = file.name.split('.');
					fileName.splice(fileName.length - 1, 0, Date.now());
					return fileName.join('.');
				},
				allowedContentTypes: supportTypes,
				//maxFileSize: can pass a function(file, req, res) or number
				//acl: can pass a function(file, req, res)
			};

			Container.upload(req, res, options, updateGoal);
		}

		function updateGoal() {
			if (arguments[0] instanceof Error) return next(arguments[0]);

			var file = arguments[1].files.file[0];
			file.createdAt = new Date();

			goal.evidences.push(file);
			goal.updateAttributes({evidences: goal.evidences}, next);
		}
	};

	Goal.prototype.removeEvidence = function(fileName, next) {
		var Container = Goal.app.models.FilesContainer;
		var goal = this;

		for (var i = Object.keys(goal.evidences).length - 1; i >= 0; i--) {
			if (goal.evidences[i].name === fileName) {
				goal.evidences.splice(i, 1);
				break;
			}
		}

		goal.updateAttributes({evidences: goal.evidences}, function(err, freshGoal) {
			if (err) return next(err);

			next(null, freshGoal);

			Container.removeFile(goal._id.toString(), fileName);
		});
	};

	Goal.prototype.leaveVote = function(req, achieve, comment, next) {
		achieve = !!achieve;

		var senderId = req.accessToken.userId;
		var goal = this;

		if (goal._ownerId === senderId) return next(new ApiError(403));
		if (goal.state !== 2 && goal.state !== 4) return next(new ApiError(403));

		async.series([
			isHaveAcessToGoal.bind(null, senderId, goal),
			createUpdateVote
		], function(err, results) {
			if (err) return next(err);

			var freshGoal = results[1];

			next(null, freshGoal);

			Goal.app.models.Customer.find({
				where: {_id: {inq: [senderId, freshGoal._ownerId]}}
			}, notifyOwner);
		});

		function createUpdateVote(cb) {
			var vote = {
				approved: achieve,
				_approverId: senderId,
				comment: !achieve && comment ? comment : '',
				createdAt: new Date()
			};

			var isHaveVote = goal.votes.some(function(v) {
				return v._approverId === senderId
			});

			if (!isHaveVote) {
				goal.votes.push(vote);
			} else {
				for (var i = goal.votes.length - 1; i >= 0; i--) {
					if (goal.votes[i]._approverId === senderId) {
						goal.votes[i] = vote;
						break;
					}
				}
			}

			var isHaveRejectedVote = goal.votes.some(function(v) {
				return v.approved === false
			});

			if (goal.state === 4 && !isHaveRejectedVote) {
				goal.state = 2;
			} else if (goal.state === 2 && !achieve) {
				goal.state = 4;
			}

			goal.updateAttributes({
				votes: goal.votes,
				state: goal.state
			}, cb);
		}

		function notifyOwner(err, members) {
			if (err || members.length !== 2) return;

			var sender = members.filter(function(m) {return m._id === senderId})[0];
			var owner = members.filter(function(m) {return m._id !== senderId})[0];

			mailer.notifyByEmail(
				owner.email,
				'Goal evidences was ' + (achieve ? 'approve' : 'rejected'),
				[
					'Hi ' + owner.firstName,

					sender.firstName + ' ' + sender.lastName + ', was ' + (achieve ? 'approve' : 'rejected') + ' your goal evidence, for this goal:',

					'app.themastermind.nz/group/' + goal._groupId + '/upload-goal-evidence/' + goal._id,

					comment ? 'His comment:\r\r' + comment : ''
				].join('\r\r')
			);
		}
	};

	// Deny set manualy id, state, evidences, feedbacks, votes
	Goal.beforeRemote('create', delIdStateEvidencesFeedbacksVotes);
	Goal.beforeRemote('prototype.updateAttributes', delIdStateEvidencesFeedbacksVotes);
	// Deny change dueDate and _groupId for goal
	Goal.beforeRemote('prototype.updateAttributes', delDueDateGroupId);
	// Make sure _ownerId set properly
	Goal.beforeRemote('create', setOwnerId);
	Goal.beforeRemote('prototype.updateAttributes', setOwnerId);
	// Make sure _groupId set properly
	Goal.beforeRemote('create', checkGroupId);
	// Deny change goal when due date reached
	Goal.beforeRemote('prototype.updateAttributes', denyIfDueDateReached);
	// Return only sender goals
	Goal.afterRemote('find', onlyOwnGoals);
	// Check is owner or group member
	Goal.afterRemote('findById', checkIsOwnerOrGroupMember.bind(null, false));
	Goal.afterRemote('findOne', checkIsOwnerOrGroupMember.bind(null, false));
	Goal.beforeRemote('prototype.__get__Group', checkIsOwnerOrGroupMember.bind(null, true));
	Goal.beforeRemote('prototype.__get__Owner', checkIsOwnerOrGroupMember.bind(null, true));
	// Exclude protected fields from responce
	Goal.afterRemote('prototype.__get__Owner', excludeFields);

	function delIdStateEvidencesFeedbacksVotes(ctx, goal, next) {
		delete ctx.req.body._id;
		delete ctx.req.body.state;
		delete ctx.req.body.evidences;
		delete ctx.req.body.feedbacks;
		delete ctx.req.body.votes;
		next();
	}

	function delDueDateGroupId(ctx, goal, next) {
		delete ctx.req.body.dueDate;
		delete ctx.req.body._groupId;
		next();
	}

	function setOwnerId(ctx, goal, next) {
		ctx.req.body._ownerId = ctx.req.accessToken.userId;
		next();
	}

	function checkGroupId(ctx, goal, next) {
		if (!ctx.req.body._groupId) return next();

		Goal.app.models.Group.findById(ctx.req.body._groupId, function(err, group) {
			if (err) return next(err);
			if (!group) return next(ApiError.incorrectParam('_groupId'));
			if (isOwnerOrMember(ctx.req.accessToken.userId, group)) return next();

			next(new ApiError(403, 'You are not member in this group!'));
		});
	}

	function denyIfDueDateReached(ctx, goal, next) {
		if (Date.now() >= new Date(ctx.instance.dueDate)) {
			return next(new ApiError(403, 'Goal due date has been expired!'));
		}

		next();
	}

	function onlyOwnGoals(ctx, goal, next) {
		var senderId = ctx.req.accessToken.userId.toString();
		var goals = ctx.result;

		for (var i = 0; i < goals.length; i++) {
			if (goals[i]._ownerId.toString() !== senderId) {
				goals.splice(i, 1);
				i--;
			}
		}

		next();
	}

	function checkIsOwnerOrGroupMember(isProtoMethod, ctx, goal, next) {
		var senderId = ctx.req.accessToken.userId;

		if (isProtoMethod) return isHaveAcessToGoal(senderId, ctx.instance, next);
		if (goal) return isHaveAcessToGoal(senderId, goal, next);

		next();
	}

	function excludeFields(ctx, group, next) {
		ctx.result = changeModelByWhiteList(ctx.result);
		next();
	}

	function isHaveAcessToGoal(userId, goal, cb) {
		Goal.app.models.Group.findById(goal._groupId, function(err, group) {
			if (err) return cb(err);

			if (!group || userId !== goal._ownerId &&
				!isOwnerOrMember(userId, group)) {
				return cb(new ApiError(403));
			}

			cb();
		});
	}
};