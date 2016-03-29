var moment = require('moment');
var ApiError = require('../../../server/lib/error/Api-error');
var mailer = require('../../../server/lib/mailer');
var GOALSTATES = require('../additional/resources').goalStates;
var isOwnerOrMember = require('../group/group').isOwnerOrMember;
var changeModelByWhiteList = require('../group/group').changeModelByWhiteList;

module.exports = function(Goal) {
	Goal.validatesPresenceOf('_ownerId', '_groupId');
	Goal.validatesInclusionOf('state', {in: GOALSTATES});
	Goal.validate('dueDate', function(err) { if (this.dueDate <= new Date()) err(); });

	// Disable unnecessary methods
	Goal.disableRemoteMethod('upsert', true);
	Goal.disableRemoteMethod('deleteById', true);
	Goal.disableRemoteMethod('exists', true);
	Goal.disableRemoteMethod('createChangeStream', true);
	Goal.disableRemoteMethod('__delete__Votes', false);
	Goal.disableRemoteMethod('__updateById__Votes', false);
	Goal.disableRemoteMethod('__destroyById__Votes', false);
	Goal.disableRemoteMethod('__findById__Votes', false);
	Goal.disableRemoteMethod('__destroyById__Votes', false);
	Goal.disableRemoteMethod('__count__Votes', false);

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
	// Add comments
	Goal.remoteMethod('addComments', {
		isStatic: false,
		description: 'Add comments to explain what you have done to achieve the goal.',
		http: {path: '/add-comments', verb: 'post'},
		accepts: [
			{arg: 'comments', type: 'string', description: 'Comments', required: true}
		]
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

	Goal.prototype.leaveFeedback = function(req, feedback, next) {
		var senderId = req.accessToken.userId;
		var goal = this;

		if (!feedback) return next(ApiError.incorrectParam('feedback'));

		isHaveAcessForGoal(senderId, goal, function(err) {
			if (err) return next(err);

			goal.feedbacks.push({
				_id: senderId,
				feedback: feedback
			});

			goal.updateAttributes({feedbacks: goal.feedbacks}, next);
		});
	};

	Goal.prototype.addComments = function(comments, next) {
		var goal = this;

		if (!comments) return next(ApiError.incorrectParam('comments'));

		goal.updateAttributes({comments: comments}, next);
	};

	Goal.prototype.notifyGroupMembers = function(next) {
		var goal = this;

		if (!goal.evidences.length) {
			return next(new ApiError(403, 'Goal evidence files don\'t presense'));
		}

		Goal.app.models.Group.findById(goal._groupId, function(err, group) {
			if (err) return next(err);
			if (!group) return next(new ApiError(404, 'Goal group not found!'));

			var recipients = group._memberIds.concat(group._ownerId).filter(function(id) {
				return id !== goal._ownerId;
			});

			mailer.notifyById(
				recipients,
				'Member goal has been achieved',
				'an email is sent to all other members of the group with a mobile friendly version of the ‘Goals Review Page 2’ and link to the ‘goals review page 1’ where members can decide if they think the user has met their objective or not.',
				next
			);
		});
	};

	Goal.prototype.uploadEvidence = function(req, res, next) {
		var Container = Customer.app.models.FilesContainer;
		var goal = this;

		Container.getContainers(function (err, containers) {
			if (err) return next(err);

			if (containers.some(function(c) { return c.name === goal._id; })) {
				return Container.upload(req, res, { container: goal._id }, next);
			}

			Container.createContainer({ name: goal._id }, function(err, c) {
				if (err) return next(err);
				Container.upload(req, res, { container: goal._id }, next);
			});
		});
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
	// Return only sender goals
	Goal.afterRemote('find', onlyOwnGoals);
	// Check is owner or group member
	Goal.afterRemote('findById', checkIsOwnerOrGroupMember.bind(null, false));
	Goal.afterRemote('findOne', checkIsOwnerOrGroupMember.bind(null, false));
	Goal.beforeRemote('prototype.__get__Group', checkIsOwnerOrGroupMember.bind(null, true));
	Goal.beforeRemote('prototype.__get__Owner', checkIsOwnerOrGroupMember.bind(null, true));
	Goal.beforeRemote('prototype.__get__Votes', checkIsOwnerOrGroupMember.bind(null, true));
	// Check permision for new vote, set properly _approverId
	Goal.beforeRemote('prototype.__create__Votes', properlyCreateVote);
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

			next(new ApiError(403, 'You are not member in this group'));
		});
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

		if (isProtoMethod) return isHaveAcessForGoal(senderId, ctx.instance, next);
		if (goal) return isHaveAcessForGoal(senderId, goal, next);

		next();
	}

	function properlyCreateVote(ctx, goal, next) {
		var senderId = ctx.req.accessToken.userId;
		var goal = ctx.instance;

		if (moment() >= moment(goal.dueDate)) return next(new ApiError(403, 'Goal expired!'));
		if (goal._ownerId === senderId) return next(new ApiError(403));

		Goal.app.models.Group.findById(goal._groupId, function(err, group) {
			if (err) return next(err);
			if (!group || !isOwnerOrMember(senderId, group)) return next(new ApiError(403));

			for (var i = goal.votes.length - 1; i >= 0; i--) {
				if (goal.votes[i]._approverId === senderId) {
					return next(new ApiError(403, 'You have already voted!'));
				}
			}

			ctx.args.data._approverId = senderId;
			ctx.args.data.createdAt = new Date();

			next();
		});
	}

	function excludeFields(ctx, group, next) {
		ctx.result = changeModelByWhiteList(ctx.result);
		next();
	}

	function isHaveAcessForGoal(userId, goal, cb) {
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