var app = require('../../../server/server');
var moment = require('moment-timezone');
var async = require('async');
var ApiError = require('../../../server/lib/error/Api-error');
var mailer = require('../../../server/lib/mailer');
var resources = require('../additional/resources');
var PENALTYAMOUNTS = resources.penaltyAmounts;
var GROUPTYPES = resources.groupTypes;

module.exports = function(Group) {
	var groupTypesWhiteList = Object.keys(GROUPTYPES).map(function (item) {
		return Number(item);
	});

	Group.validatesPresenceOf('_ownerId');
	Group.validatesInclusionOf('type', {in: groupTypesWhiteList});
	Group.validatesInclusionOf('penalty', {in: PENALTYAMOUNTS});
	Group.validate('maxMembers', function(err) { if (this.maxMembers < 1) err(); });

	// Disable unnecessary methods
	Group.disableRemoteMethod('upsert', true);
	Group.disableRemoteMethod('exists', true);
	Group.disableRemoteMethod('createChangeStream', true);
	Group.disableRemoteMethod('__create__Members', false);
	Group.disableRemoteMethod('__delete__Members', false);
	Group.disableRemoteMethod('__updateById__Members', false);
	Group.disableRemoteMethod('__destroyById__Members', false);
	Group.disableRemoteMethod('__link__Members', false);
	Group.disableRemoteMethod('__create__SessionConf', false);
	Group.disableRemoteMethod('__destroy__SessionConf', false);

	// Change group owner request
	Group.remoteMethod('changeGroupOwner', {
		isStatic: false,
		description: 'Change group owner.',
		http: {path: '/change-owner/:ownerId', verb: 'put'},
		accepts: [
			{arg: 'ownerId', type: 'string', description: 'New owner id', required: true}
		]
	});
	// Email to all members from group member
	Group.remoteMethod('sendEmailToGroup', {
		isStatic: false,
		description: 'Send email to group members.',
		http: {path: '/send-email-group', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'message', type: 'string', description: 'Message', required: true}
		]
	});
	// Email to group member
	Group.remoteMethod('sendEmailToMember', {
		isStatic: false,
		description: 'Send email to group member.',
		http: {path: '/send-email-member/:memberId', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'message', type: 'string', description: 'Message', required: true},
			{arg: 'memberId', type: 'string', description: 'Receiver id', required: true}
		]
	});
	// Invite new members
	Group.remoteMethod('inviteNewMembers', {
		isStatic: false,
		description: 'Invite new members to the group.',
		http: {path: '/invite-new-members', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'emails', type: 'string', description: 'Email addresses. Separate each address with a ";"', required: true},
			{arg: 'request', type: 'string', description: 'Invite request', required: true}
		]
	});
	// Request to join the group
	Group.remoteMethod('requestToJoin', {
		isStatic: false,
		description: 'Request to join the group.',
		http: {path: '/request-to-join', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'request', type: 'string', description: 'Message to group owner requesting permission to join.', required: true}
		]
	});
	// Get base group info for any users
	Group.remoteMethod('baseGroupInfo', {
		isStatic: false,
		description: 'Get base group info for non authenticated users.',
		http: {path: '/base-info', verb: 'get'},
		returns: {type: 'object', root: true}
	});
	// Get active requests to join the group
	Group.remoteMethod('activeJoinRequests', {
		isStatic: false,
		description: 'Get active requests to join the group.',
		http: {path: '/active-join-requests', verb: 'get'},
		returns: {type: 'array', root: true}
	});
	// Approve request to join the group
	Group.remoteMethod('approveRequest', {
		isStatic: false,
		description: 'Approve request to join the group.',
		http: {path: '/approve-request/:requestId', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'requestId', type: 'string', description: 'Request id', required: true}
		]
	});
	// Reject request to join the group
	Group.remoteMethod('rejectRequest', {
		isStatic: false,
		description: 'Reject request to join the group.',
		http: {path: '/reject-request/:requestId', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'requestId', type: 'string', description: 'Request id', required: true}
		]
	});
	// Get count for passed sessions
	Group.remoteMethod('countPassedSessions', {
		isStatic: false,
		description: 'Get count for passed sessions.',
		http: {path: '/passed-sessions-count', verb: 'get'},
		returns: {arg: 'count', type: 'number'}
	});
	// Provide excuse for the next mastermind session
	Group.remoteMethod('provideExcuse', {
		isStatic: false,
		description: 'Provide excuse for the next mastermind session.',
		http: {path: '/provide-excuse', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'excuse', type: 'string', description: 'Excuse', required: true}
		],
		returns: {type: 'object', root: true}
	});
	// Approve excuse
	Group.remoteMethod('approveExcuse', {
		isStatic: false,
		description: 'Approve excuse for the next masterind session.',
		http: {path: '/:sessionId/approve-excuse/:excuseId', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'sessionId', type: 'string', description: 'Session id', required: true},
			{arg: 'excuseId', type: 'string', description: 'Excuse id', required: true}
		]
	});
	// Return member goals
	Group.remoteMethod('memberGoals', {
		isStatic: false,
		description: 'Return group members goals.',
		http: {path: '/member-goals/:memberId', verb: 'get'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'memberId', type: 'string', description: 'Member id', required: true}
		],
		returns: {type: 'array', root: true}
	});
	// Return related active goals
	Group.remoteMethod('relatedActiveGoals', {
		isStatic: false,
		description: 'Return related active goals.',
		http: {path: '/related-active-goals', verb: 'get'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}}
		],
		returns: {type: 'array', root: true}
	});
	// Manually shedule next session
	Group.remoteMethod('manuallyScheduleSession', {
		isStatic: false,
		description: 'Manually shedule next group session.',
		http: {path: '/manually-shedule-session', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'startAt', type: 'number', description: 'Session due date (milliseconds since 1970)', required: true}
		],
		returns: {type: 'object', root: true}
	});

	Group.prototype.changeGroupOwner = function(ownerId, next) {
		var Customer = Group.app.models.Customer;
		var group = this;

		for (var i = group._memberIds.length - 1; i >= 0; i--) {
			var id = group._memberIds[i].toString();

			if (id === ownerId) {
				group._memberIds.splice(i, 1);
				group._ownerId = id;

				return group.save(function(err, freshGroup) {
					if (err) return next(err);
					next();

					// Notify new owner and group members
					Customer.findById(freshGroup._ownerId, function(err, newOwner) {
						if (err || !newOwner) return;

						mailer.notifyByEmail(
							newOwner.email,
							'Change group owner',
							'You are the new owner of the group "' + freshGroup.name + '"'
						);

						mailer.notifyById(
							freshGroup._memberIds,
							'Change group owner',
							'The owner of the "' + freshGroup.name + '" group changed to ' + newOwner.firstName + ' ' + newOwner.lastName
						);
					});
				});
			}
		}

		next(new ApiError(404, 'Member not found in group'));
	};

	Group.prototype.sendEmailToGroup = function(req, message, next) {
		var senderId = req.accessToken.userId;
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!message) return next(ApiError.incorrectParam('message'));

		Group.app.models.Customer.find({
			where: {_id: {inq: group._memberIds.concat(group._ownerId)}}
		}, function(err, members) {
			if (err) return next(err);
			if (!members.length) return next(new ApiError(404, 'Members not found'));

			next();

			var sender = members.filter(function(m) {return m._id === senderId;})[0];
			var recipientsEmail = members.map(function(m) {return m.email;});

			mailer.notifyByEmail(
				recipientsEmail,
				'Message from ' + sender.firstName + ' ' + sender.lastName,
				message
			);
		});
	};

	Group.prototype.sendEmailToMember = function(req, message, memberId, next) {
		var senderId = req.accessToken.userId.toString();
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!message) return next(ApiError.incorrectParam('message'));
		if (!isOwnerOrMember(memberId, group) || senderId === memberId) {
			return next(new ApiError(404, 'Member not found in group'));
		}

		Group.app.models.Customer.find({
			where: {_id: {inq: [senderId, memberId]}}
		}, function(err, members) {
			if (err) return next(err);

			var senderName = '';
			var recipientEmail = '';

			members.forEach(function(member) {
				var mId = member._id.toString();

				if (mId === senderId) {
					senderName = member.firstName + ' ' + member.lastName;
				} else if (mId === memberId) {
					recipientEmail = member.email;
				}
			});

			mailer.notifyByEmail(
				recipientEmail,
				'Message from ' + senderName,
				message,
				next
			);
		});
	};

	Group.prototype.inviteNewMembers = function(req, emails, request, next) {
		var senderId = req.accessToken.userId.toString();
		var group = this;

		emails = prepareEmails(emails);

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!request) return next(ApiError.incorrectParam('request'));
		if (group._ownerId != senderId && !group.memberCanInvite) {
			return next(new ApiError(403, 'Member can\'t invite'));
		}

		Group.app.models.Customer.findById(senderId, function(err, sender) {
			if (err) return next(err);
			if (!sender) return next(new ApiError(404, 'Sender not found!'));

			mailer.notifyByEmail(
				emails,
				sender.firstName + ' has invited to join a mastermind group',
				request,
				next
			);
		});
	};

	Group.prototype.requestToJoin = function(req, request, next) {
		var JoinRequest = Group.app.models.JoinRequest;
		var Customer = Group.app.models.Customer;
		var senderId = req.accessToken.userId.toString();
		var group = this;

		if (isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!request) return next(ApiError.incorrectParam('request'));

		async.waterfall([
			function(cb) {
				JoinRequest.findOrCreate({
					where: {
						_ownerId: senderId,
						_groupId: group._id,
						closed: false
					}
				}, {
					request: request,
					_ownerId: senderId,
					_groupId: group._id
				}, function(err, result, created) {
					if (err) return cb(err);
					if (created) return cb();
					// if find another active request
					cb(new ApiError(403, 'Already have active request'));
				});
			},
			Customer.findById.bind(Customer, group._ownerId),
			function(customer, cb) {
				mailer.notifyByEmail(
					customer.email,
					'You have a new request to join your mastermind',
					[
						'Hi ' + customer.firstName,

						'You have a new request to join your group ' + group.name,

						'Here is the request:\r',

						request + '\r\r',

						'If you would like to view the request in your group admin area then:',

						'1) Login at: www.themastermind.nz/members',

						'2) Goto app.themastermind.nz/group/' + group._id + '/join-requests'
					].join('\r\r'),
					cb
				);
			}
		], next);
	};

	Group.prototype.baseGroupInfo = function(next) {
		next(null, {
			_id: this._id,
			name: this.name,
			description: this.description,
			penalty: this.penalty,
			createdAt: this.createdAt,
			sessionConf: this.sessionConf
		});
	};

	Group.prototype.activeJoinRequests = function(next) {
		Group.app.models.JoinRequest.find({
			where: {
				closed: false,
				_groupId: this._id
			},
			include: 'Owner'
		}, next);
	};

	Group.prototype.approveRequest = function(req, requestId, next) {
		var JoinRequest = Group.app.models.JoinRequest;
		var Customer = Group.app.models.Customer;
		var group = this;
		var haveFreeSpace = currentNumberMembers(group) < group.maxMembers;

		if (!haveFreeSpace) return next(new ApiError(403, 'Group don\'t have free space'));

		async.waterfall([
			findRequest,
			findRequestOwner,
			updateModelsAndNotifyRequestOwner
		], next);

		function findRequest(cb) {
			JoinRequest.findOne({
				where: {
					_id: requestId,
					_groupId: group._id,
					closed: false
				}
			}, cb);
		}

		function findRequestOwner(request, cb) {
			if (!request) return cb(new ApiError(404, 'Request to join not found'));

			Customer.findById(request._ownerId, function(err, customer) {
				if (err) return cb(err);
				if (!customer) return cb(new ApiError(404, 'Request owner not found'));

				cb(null, request, customer);
			});
		}

		function updateModelsAndNotifyRequestOwner(request, requestOwner, cb) {
			// save membersList before change
			var oldMembersIds = group._memberIds.slice();

			async.series([
				function(callback) {
					request.approved = true;
					request.closed = true;
					request.save(callback);
				},
				function(callback) {
					group._memberIds.push(requestOwner._id);
					group.save(callback);
				},
				function(callback) {
					mailer.notifyByEmail(
						requestOwner.email,
						group.name + ' has accepted your request',
						[
							'Hi ' + requestOwner.firstName + '\r\r',

							'You request to join the group ' + group.name + ' has been accepted.\r\r',

							'To login to your account click on the link below:\r\r',

							'www.themastermind.nz/members'
						].join(''),
						callback
					);
				}
			], function(err) {
				if (err) return cb(err);

				cb();

				mailer.notifyById(
					oldMembersIds,
					'New group member',
					'A new member of the "' + group.name + '" group is ' + requestOwner.firstName + ' ' + requestOwner.lastName
				);
			});
		}
	};

	Group.prototype.rejectRequest = function(req, requestId, next) {
		var JoinRequest = Group.app.models.JoinRequest;
		var Customer = Group.app.models.Customer;
		var group = this;

		async.waterfall([
			// Find request
			function(cb) {
				JoinRequest.findOne({
					where: {
						_id: requestId,
						_groupId: group._id,
						closed: false
					}
				}, cb);
			},
			// Find request owner
			function(request, cb) {
				if (!request) return cb(new ApiError(404, 'Request to join not found'));

				Customer.findById(request._ownerId, function(err, customer) {
					if (err) return cb(err);
					if (!customer) return cb(new ApiError(404, 'Request owner not found'));

					cb(null, request, customer);
				});
			},
			// Update request model and notify request owner
			function(request, customer, cb) {
				request.approved = false;
				request.closed = true;

				request.save(function(err) {
					if (err) return cb(err);

					mailer.notifyByEmail(
						customer.email,
						group.name + ' has declined your request',
						[
							'Hi ' + customer.firstName + '\r\r',

							'You request to join the group' + group.name + 'has been declined.\r\r',

							'To login to your account click on the link below:\r\r',

							'www.themastermind.nz/members'
						].join(''),
						cb
					);
				});
			}
		], next);
	};

	Group.prototype.countPassedSessions = function(next) {
		var now = new Date(moment().utc().format()).getTime();

		Group.app.models.Session.count({
			_groupId: this._id,
			startAt: {lt: now}
		}, next);
	};

	Group.prototype.provideExcuse = function(req, excuse, next) {
		var senderId = req.accessToken.userId.toString();
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!group._nextSessionId) return next(new ApiError(404, 'Next session not found'));
		if (!excuse) return next(ApiError.incorrectParam('excuse'));

		Group.app.models.Session.findById(group._nextSessionId, function(err, session) {
			if (err) return next(err);
			if (!session) return next(new ApiError(404, 'Next session not found'));

			var isAlreadyExistExcuse = Object.keys(session.excuses).some(function(id) {
				return id === senderId;
			});

			if (isAlreadyExistExcuse) return next(new ApiError(403, 'Already have excuse'));

			session.excuses[senderId] = {
				excuse: excuse,
				_votes : []
			};

			session.updateAttributes({ excuses: session.excuses }, function(err, freshSess) {
				if (err) return next(err);

				next(null, freshSess);

				Group.app.models.Customer.find({
					where: {_id: {inq: group._memberIds.concat(group._ownerId)}}
				}, function(err, members) {
					if (err || !members.length) return;

					var sender = members.filter(function(m) {return m._id === senderId;})[0];
					var recipients = members.filter(function(m) {return m._id !== senderId;});

					recipients.forEach(function(recipient) {
						mailer.notifyByEmail(
							recipient.email,
							sender.firstName + ' ' + sender.lastName + ' has sent an excuse',
							[
								'Hi ' + recipient.firstName,

								sender.firstName + ' ' + sender.lastName + ' has sent an excuse to not join the next meeting. His reason is:',

								excuse,

								'To accept the excuse click the link below:',

								'app.themastermind.nz/group/' + group._id + '/session/' + group._nextSessionId + '/approve-excuse/' + senderId,

								'To reject the excuse click the link below:',

								'app.themastermind.nz/group/' + group._id + '/session/' + group._nextSessionId + '/reject-excuse/' + senderId
							].join('\r\r')
						);
					});
				});
			});
		});
	};

	Group.prototype.approveExcuse = function(req, sessionId, excuseId, next) {
		var senderId = req.accessToken.userId;
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!group._nextSessionId || group._nextSessionId.toString() !== sessionId) {
			return next(new ApiError(403, 'Session is not relevant'));
		}
		if (excuseId === senderId) return next(new ApiError(403, 'You can\'t leave vote for your excuse'));

		Group.app.models.Session.findById(group._nextSessionId, function(err, session) {
			if (err) return next(err);
			if (!session) return next(new ApiError(404, 'Next session not found'));
			if (!session.excuses[excuseId]) return next(new ApiError(404, 'Excuse not found'));
			if (session.excuses[excuseId]._votes.indexOf(senderId) >= 0) {
				return next(new ApiError(403, 'You already have left your vote'));
			}

			session.excuses[excuseId]._votes.push(senderId);

			session.updateAttributes({excuses: session.excuses}, next);
		});
	};

	Group.prototype.memberGoals = function(req, memberId, next) {
		var senderId = req.accessToken.userId;
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!isOwnerOrMember(memberId, group)) return next(ApiError.incorrectParam('memberId'));

		Group.app.models.Goal.find({
			where: {and: [{_ownerId: memberId}, {_groupId: group._id}]}
		}, next);
	};

	Group.prototype.relatedActiveGoals = function(req, next) {
		var senderId = req.accessToken.userId;
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));

		Group.app.models.Goal.find({
			where: {
				_groupId: group._id,
				state: {inq: [1, 2, 4]}
			}
		}, next);
	};

	Group.prototype.manuallyScheduleSession = function(req, startAt, next) {
		var group = this;
		var minStartAt = new Date().setMinutes(new Date().getMinutes() + 7);

		startAt = new Date(startAt || minStartAt);

		if (startAt.toString() === 'Invalid Date' || startAt < minStartAt) {
			return next(ApiError.incorrectParam('startAt'));
		}
		// startAt time always have secconds 0
		startAt.setSeconds(0);

		if (!group._nextSessionId) {
			createSession(group, startAt, updateGroup);
		} else {
			updateSession(group, startAt, updateGroup);
		}

		function updateGroup(err, freshSession) {
			if (err) return next(err);

			group.updateAttributes({_nextSessionId: freshSession._id}, function(err, freshGroup) {
				if (err) return next(err);

				next(null, freshSession);

				Group.app.models.Customer.find({
					where: {_id: {inq: group._memberIds}}
				}, function(err, members) {
					if (err) return;
					if (!members.length) return;

					members.forEach(function(member) {
						mailer.notifyByEmail(
							member.email,
							'Scheduled mastermind session',
							[
								'Hi ' + member.firstName + '\r\r',

								'The owner of the "' + freshGroup.name + '" group,',
								' had just sheduled the next mastermind session on:\r',
								freshSession.startAt + '\r\r',

								'To join click the link below and login:\r\r',

								'app.themastermind.nz/session/' + freshGroup._id + '/start'
							].join('')
						);
					});
				});
			});
		}
	};

	// Deny set manualy id, memberIds, nextSessionId, lastSessionId fields
	Group.beforeRemote('create', excludeIdMemberIdsSessionsFields);
	Group.beforeRemote('prototype.updateAttributes', excludeIdMemberIdsSessionsFields);
	// Make sure _ownerId set properly
	Group.beforeRemote('create', setOwnerId);
	Group.beforeRemote('prototype.updateAttributes', setOwnerId);
	// Validate roundLength field
	Group.beforeRemote('create', validateRoundLengthField);
	Group.beforeRemote('prototype.updateAttributes', validateRoundLengthField);
	Group.beforeRemote('prototype.__update__SessionConf', validateRoundLengthField);
	// Create next session for group
	Group.afterRemote('create', createNextSession);
	Group.afterRemote('prototype.updateAttributes', updateNextSession);
	Group.afterRemote('prototype.__update__SessionConf', updateNextSession);
	// Delete next session after delete group
	Group.afterRemote('deleteById', deleteNextSession);
	// Delete related goals after delete group
	Group.afterRemote('deleteById', deleteRelatedGoals);
	// Validate maxMembers field
	Group.beforeRemote('prototype.updateAttributes', validateMaxMembersField);
	// Allow members to leave the group
	Group.beforeRemote('prototype.__unlink__Members', allowMembersLeaveGroup);
	// Delete member's goals which related to group
	Group.afterRemote('prototype.__unlink__Members', deleteGoalsRelatedGroup);
	// Exclude private group(s) where user don't owner or member
	Group.afterRemote('find', excludePrivateGroups);
	Group.afterRemote('findOne', excludePrivateGroups);
	Group.afterRemote('findById', excludePrivateGroups);
	// Return private group only for owner and members
	Group.beforeRemote('prototype.__get__LastSession', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__NextSession', checkIsGroupMember);
	Group.beforeRemote('prototype.__count__Members', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__SessionConf', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__Owner', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__Members', checkIsGroupMember);
	Group.beforeRemote('prototype.__findById__Members', checkIsGroupMember);
	// Exclude protected fields from responce
	Group.afterRemote('prototype.__get__Owner', excludeFields);
	Group.afterRemote('prototype.__get__Members', excludeFields);
	Group.afterRemote('prototype.__findById__Members', excludeFields);

	function excludeIdMemberIdsSessionsFields(ctx, group, next) {
		delete ctx.req.body._id;
		delete ctx.req.body._memberIds;
		delete ctx.req.body._nextSessionId;
		delete ctx.req.body._lastSessionId;
		next();
	}

	function setOwnerId(ctx, group, next) {
		ctx.req.body._ownerId = ctx.req.accessToken.userId;
		next();
	}

	function validateRoundLengthField(ctx, group, next) {
		var methodName = ctx.req.remotingContext.method.name;
		var isUpdateSessConf = methodName === '__update__SessionConf';
		var sessionConf = isUpdateSessConf ? ctx.req.body : ctx.req.body.sessionConf || {};
		var roundLength = sessionConf.roundLength;

		if (!Array.isArray(roundLength)) return next();

		var minLengthRound = 0;

		var round1 = roundLength[0] >= minLengthRound ? Number(roundLength[0]) : minLengthRound;
		var round2PartA = roundLength[1] >= minLengthRound ? Number(roundLength[1]) : minLengthRound;
		var round2PartB = roundLength[2] >= minLengthRound ? Number(roundLength[2]) : minLengthRound;
		var round3 = roundLength[3] >= minLengthRound ? Number(roundLength[3]) : minLengthRound;

		if (isUpdateSessConf) {
			ctx.req.body.roundLength = [round1, round2PartA, round2PartB, round3];
		} else {
			ctx.req.body.sessionConf.roundLength = [round1, round2PartA, round2PartB, round3];
		}

		next();
	}

	function createNextSession(ctx, group, next) {
		if (!group.sessionConf.sheduled) return next();

		async.waterfall([
			createSession.bind(null, group),
			function(session, cb) {
				ctx.result.updateAttributes({_nextSessionId: session._id}, cb);
			}
		], next);
	}

	function updateNextSession(ctx, group, next) {
		var groupInst = ctx.instance;
		var Session = Group.app.models.Session;

		if (!groupInst.sessionConf.sheduled && !groupInst._nextSessionId) {
			return next();
		}

		// Update session inst
		if (groupInst.sessionConf.sheduled && groupInst._nextSessionId) {
			updateSession(groupInst, next);
		}
		// Create session inst
		else if (groupInst.sessionConf.sheduled && !groupInst._nextSessionId) {
			createSession(groupInst, function(err, session) {
				if (err) return next(err);

				groupInst.updateAttributes({_nextSessionId: session._id}, next);
			});
		}
		// Delete session inst
		else if (!groupInst.sessionConf.sheduled && groupInst._nextSessionId) {
			deleteSession(groupInst._nextSessionId, function(err) {
				if (err) return next(err);

				groupInst.updateAttributes({_nextSessionId: null}, next);
			});
		}
	}

	function deleteNextSession(ctx, group, next) {
		var Session = Group.app.models.Session;
		var groupId = ctx.args.id;
		var now = new Date(moment().utc().format()).getTime();

		Session.destroyAll({
			and: [{_groupId: groupId}, {startAt: {gt: now}}]
		}, next);
	}

	function deleteRelatedGoals(ctx, group, next) {
		var Goal = Group.app.models.Goal;
		var groupId = ctx.args.id;

		Goal.destroyAll({ _groupId: groupId }, next);
	}

	function validateMaxMembersField(ctx, group, next) {
		if (ctx.req.body.maxMembers &&
			ctx.req.body.maxMembers < currentNumberMembers(ctx.instance)) {
			return next(ApiError.incorrectParam('maxMembers'));
		}

		next();
	}

	function allowMembersLeaveGroup(ctx, group, next) {
		var group = ctx.instance;
		var senderId = ctx.req.accessToken.userId.toString();
		var delUserId = ctx.req.params.fk;

		var senderIsOwner = senderId === group._ownerId.toString();
		var isMember = group._memberIds.some(function(id) {
			return id.toString() === delUserId;
		});

		if (!isMember) return next(new ApiError(404, 'Member not found in group'));
		if (senderId !== delUserId && !senderIsOwner) {
			return next(new ApiError(403));
		}

		next();
	}

	function deleteGoalsRelatedGroup(ctx, group, next) {
		var group = ctx.instance;
		var delUserId = ctx.req.params.fk;

		Group.app.models.Goal.destroyAll({
			and: [{_ownerId: delUserId}, {_groupId: group._id}]
		}, next);
	}

	function excludePrivateGroups(ctx, group, next) {
		var senderId = ctx.req.accessToken.userId;

		if (Array.isArray(ctx.result)) {
			var groups = ctx.result;

			for (var i = 0; i < groups.length; i++) {
				if (!groups[i].private) continue;

				if (!isOwnerOrMember(senderId, groups[i])) {
					groups.splice(i, 1);
					i--;
				}
			}
		} else if (ctx.result.private && !isOwnerOrMember(senderId, ctx.result)) {
			return next(new ApiError(403));
		}

		next();
	}

	function checkIsGroupMember(ctx, group, next) {
		var group = ctx.instance;
		var senderId = ctx.req.accessToken.userId.toString();

		if(group.private && !isOwnerOrMember(senderId, group)) {
			return next(new ApiError(403));
		}

		next();
	}

	function excludeFields(ctx, group, next) {
		var resData = ctx.result;

		if (resData) {
			if (Array.isArray(resData)) {
				var responce = [];

				resData.forEach(function(result) {
					var changedModel = changeModelByWhiteList(result);
					responce.push(changedModel);
				});
			} else {
				var responce = changeModelByWhiteList(resData);
			}
			ctx.result = responce;
		}

		next();
	}

	function updateSession(group, startAt, cb) {
		if (arguments.length === 2) {
			cb = startAt;
			startAt = null;
		}

		Group.app.models.Session.findById(group._nextSessionId, function(err, session) {
			if (err) return cb(err);
			if (!session) return cb(new ApiError(404, 'Session not found.'));
			if (session._facilitatorId) return next(new ApiError(403, 'During going session!'));

			startAt = startAt || calculatedStartAtDate(
				group.sessionConf.frequencyType,
				group.sessionConf.day,
				group.sessionConf.timeZone,
				group.sessionConf.time
			);

			session.updateAttributes({
				startAt: startAt,
				excuses: {}
			}, cb);
		});
	}

	function deleteSession(sessionId, cb) {
		Group.app.models.Session.findById(sessionId, function(err, session) {
			if (err) return cb(err);
			if (!session) return cb(new ApiError(404, 'Session not found.'));
			if (session._facilitatorId) return cb(new ApiError(403, 'During going session!'));

			Group.app.models.Session.destroyById(sessionId, cb);
		});
	}
};

module.exports.createSession = createSession;
module.exports.calculatedStartAtDate = calculatedStartAtDate;
module.exports.isOwnerOrMember = isOwnerOrMember;
module.exports.changeModelByWhiteList = changeModelByWhiteList;

function createSession(group, startAt, cb) {
	if (arguments.length === 2) {
		cb = startAt;
		startAt = null;
	}

	startAt = startAt || calculatedStartAtDate(
		group.sessionConf.frequencyType,
		group.sessionConf.day,
		group.sessionConf.timeZone,
		group.sessionConf.time
	);

	app.models.Session.create({
		startAt: startAt,
		_groupId: group._id 
	}, cb);
}

function calculatedStartAtDate(freqType, day, timeZone, time) {
	var nextSessDate = getDateByFreqTypeAndWeekday(freqType, day);
	var result = moment(nextSessDate)
		.tz(timeZone)
		.hour(time)
		.minute(time.split(".")[1])
		.second(0)
		.utc()
		.format();

	return new Date(result);
}

function isOwnerOrMember(userId, group) {
	return group._memberIds.concat(group._ownerId).some(function(id) {
		return id.toString() === userId.toString();
	});
}

function changeModelByWhiteList(resource) {
	var WHITE_LIST_FIELDS = ['_id', 'firstName', 'lastName', 'timeZone', 'description', 'avatar', 'social'];
	var destination = {};

	WHITE_LIST_FIELDS.forEach(function(field) {
		destination[field] = resource[field];
	});

	return destination;
}

function currentNumberMembers(group) {
	return group._memberIds.length + 1;
}

function prepareEmails(emails) {
	// trim spaces
	emails = emails.split(';').map(function(email) {
		return email.replace(/^\s+/, '').replace(/\s+$/, '');
	});
	// remove invalid emails
	var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	emails = emails.filter(function(email) {
		return re.test(email);
	});

	return emails.join(', ');
}

function getDateByFreqTypeAndWeekday(freqType, day) {
	var d = new Date();
	var curDate = d.getDate();

	d.setDate(1)

	// Get the first desired weekday in the month
	while(d.getDay() !== day) {
		d.setDate(d.getDate() + 1);
	}

	// Weekly
	if (freqType === 1) {
		var curMonth = d.getMonth();

		while(d.getMonth() === curMonth) {
			if (d.getDate() > curDate) return d;
			d.setDate(d.getDate() + 7);
		}
		// if in cur month not find desired day
		return d;
	}

	// First, Second, Third or Fourth week
	if (freqType >= 2 && freqType <= 5) {
		var desiredWeek = freqType - 2;

		d.setDate(d.getDate() + 7 * desiredWeek);
		if (d.getDate() > curDate) return d;

		// increase month
		d.setDate(1);
		d.setMonth(d.getMonth() + 1);

		while(d.getDay() !== day) {
			d.setDate(d.getDate() + 1);
		}

		d.setDate(d.getDate() + 7 * desiredWeek);
		return d;
	}

	// First and third week
	if (freqType === 6) {
		// First week
		if (d.getDate() > curDate) return d;

		// Increase to third week
		d.setDate(d.getDate() + 14);
		if (d.getDate() > curDate) return d;

		// Get date from first week next month
		d.setDate(1);
		d.setMonth(d.getMonth() + 1);

		while(d.getDay() !== day) {
			d.setDate(d.getDate() + 1);
		}
		return d;
	}

	// Second and fourth week
	if (freqType === 7) {
		// Increase to second week
		d.setDate(d.getDate() + 7);
		if (d.getDate() > curDate) return d;

		// Increase to fourth week
		d.setDate(d.getDate() + 14);
		if (d.getDate() > curDate) return d;

		// Get date from second week next month
		d.setDate(1);
		d.setMonth(d.getMonth() + 1);

		while(d.getDay() !== day) {
			d.setDate(d.getDate() + 1);
		}
		d.setDate(d.getDate() + 7);
		return d;
	}
}