var loopback = require('loopback');
var moment = require('moment');
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
		]
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
							'The owner of the "' + freshGroup.name + '" group changed to ' + newOwner.firstName + ' ' + owner.lastName
						);
					});
				});
			}
		}

		next(ApiError.incorrectParam('ownerId'));
	};

	Group.prototype.sendEmailToGroup = function(req, message, next) {
		var senderId = req.accessToken.userId.toString();
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!message) return next(ApiError.incorrectParam('message'));
		if (!group._memberIds.length) return next(new ApiError(404, 'Members not found'));

		Group.app.models.Customer.findById(senderId, function(err, sender) {
			if (err) return next(err);

			var recipients = group._memberIds
				.concat(group._ownerId)
				.filter(function(id) {
					return id.toString() !== senderId;
				});

			mailer.notifyById(
				recipients,
				'Message from ' + sender.firstName + ' ' + sender.lastName,
				message,
				next
			);
		});
	};

	Group.prototype.sendEmailToMember = function(req, message, memberId, next) {
		var senderId = req.accessToken.userId.toString();
		var group = this;

		if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));
		if (!message) return next(ApiError.incorrectParam('message'));
		if (!isOwnerOrMember(memberId, group) || senderId === memberId) {
			return next(ApiError.incorrectParam('memberId'));
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

		mailer.notifyByEmail(
			emails,
			'Invitation to join a group.',
			request,
			next
		);
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
					cb(ApiError(403, 'Already have active request'));
				});
			},
			Customer.findById.bind(Customer, group._ownerId),
			function(customer, cb) {
				mailer.notifyByEmail(
					customer.email,
					'Request to join the group.',
					request,
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
			}
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
						'Your request to join the group.',
						'You request to join ' + group.name + ' group was accepted.\n\nThanks',
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
						'Your request to join the group.',
						'You request to join ' + group.name + ' group was rejected.\n\nThanks',
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
				valid: true
			};
			session.updateAttributes({excuses: session.excuses}, next);
		});
	};

	// Deny set manualy id field
	Group.beforeRemote('create', delId);
	Group.beforeRemote('prototype.updateAttributes', delId);
	// Make sure _ownerId set properly
	Group.beforeRemote('create', setOwnerId);
	Group.beforeRemote('prototype.updateAttributes', setOwnerId);
	// Deny add members to group during create or update group model
	Group.beforeRemote('create', excludeMemberIdsField);
	Group.beforeRemote('prototype.updateAttributes', excludeMemberIdsField);
	// Exclude '_nextSessionId', _lastSessionId fields during create or update group model
	Group.beforeRemote('create', excludeSessionsFields);
	Group.beforeRemote('prototype.updateAttributes', excludeSessionsFields);
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
	// Validate maxMembers field
	Group.beforeRemote('prototype.updateAttributes', validateMaxMembersField);
	// Allow members to leave the group
	Group.beforeRemote('prototype.__unlink__Members', allowMembersLeaveGroup);
	// Exclude private group(s) where user don't owner or member
	Group.afterRemote('find', excludePrivateGroups);
	Group.afterRemote('findOne', excludePrivateGroups);
	Group.afterRemote('findById', excludePrivateGroups);
	// Return private group only for owner and members
	Group.beforeRemote('exists', checkIsGroupMember);
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

	function delId(ctx, group, next) {
		delete ctx.req.body._id;
		next();
	}

	function setOwnerId(ctx, group, next) {
		ctx.req.body._ownerId = ctx.req.accessToken.userId;
		next();
	}

	function excludeMemberIdsField(ctx, group, next) {
		delete ctx.req.body._memberIds;
		next();
	}

	function excludeSessionsFields(ctx, group, next) {
		delete ctx.req.body._nextSessionId;
		delete ctx.req.body._lastSessionId;
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
			updateSession(groupInst._nextSessionId, groupInst, next);
		}
		// Create session inst
		else if (groupInst.sessionConf.sheduled && !groupInst._nextSessionId) {
			async.waterfall([
				createSession.bind(null, groupInst),
				function(session, cb) {
					groupInst.updateAttributes({_nextSessionId: session._id}, cb);
				}
			], next);
		}
		// Delete session inst
		else if (!groupInst.sessionConf.sheduled && groupInst._nextSessionId) {
			async.series([
				Session.destroyById.bind(Session, groupInst._nextSessionId),
				function(cb) {
					groupInst.updateAttributes({_nextSessionId: null}, cb);
				}
			], next);
		}
	}

	function deleteNextSession(ctx, group, next) {
		var Session = Group.app.models.Session;
		var groupId = ctx.args.id;
		var now = new Date(moment().utc().format()).getTime();

		Session.destroyAll({
			and: [{_groupId: groupId}, {startAt: {gt: now}}],
		}, next);
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

		if (!isMember) return next(ApiError.incorrectParam('fk'));
		if (senderId !== delUserId && !senderIsOwner) {
			return next(new ApiError(403));
		}

		next();
	}

	function excludePrivateGroups(ctx, modelInstance, next) {
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

	function checkIsGroupMember(ctx, modelInstance, next) {
		var group = ctx.instance;
		var senderId = ctx.req.accessToken.userId.toString();

		if(group.private && !isOwnerOrMember(senderId, group)) {
			return next(new ApiError(403));
		}
	}

	function excludeFields(ctx, modelInstance, next) {
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

	function changeModelByWhiteList(resource) {
		var WHITE_LIST_FIELDS = ['_id', 'firstName', 'lastName', 'timeZone', 'description', 'avatar', 'social'];
		var destination = {};

		WHITE_LIST_FIELDS.forEach(function(field) {
			destination[field] = resource[field];
		});

		return destination;
	}

	function createSession(group, cb) {
		var startAt = calculatedStartAtDate(
			group.sessionConf.frequencyType,
			group.sessionConf.day,
			group.sessionConf.timeZone,
			group.sessionConf.time
		);

		Group.app.models.Session.create({
			startAt: startAt,
			_groupId: group._id
		}, cb);
	}

	function updateSession(sessionId, group, cb) {
		Group.app.models.Session.findById(group._nextSessionId, function(err, session) {
			if (err) return cb(err);

			var startAt = calculatedStartAtDate(
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
};

module.exports.calculatedStartAtDate = calculatedStartAtDate;

function isOwnerOrMember(userId, group) {
	var isOwner = group._ownerId.toString() === userId.toString();
	var isMember = group._memberIds.some(function(id) {
		return id.toString() === userId.toString();
	});

	return isOwner || isMember;
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