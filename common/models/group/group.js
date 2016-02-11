var loopback = require('loopback');
var async = require('async');
var mailer = require('../../../server/lib/mailer');
var resources = require('../additional/resources');
var PENALTYAMOUNTS = resources.penaltyAmounts;
var GROUPTYPES = resources.groupTypes;

var authorizationError = new Error('Authorization Required');
authorizationError.statusCode = 401;
authorizationError.code = 'AUTHORIZATION_REQUIRED';

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

	Group.prototype.changeGroupOwner = function(ownerId, next) {
		var group = this;
		var newOwnerId = ownerId;
		var invalidOwnerId = true;

		for (var i = group._memberIds.length - 1; i >= 0; i--) {
			var id = group._memberIds[i].toString();

			if (id === newOwnerId) {
				invalidOwnerId = false;

				group._memberIds.splice(i, 1);
				group._ownerId = id;
				group.save(next);
				break;
			}
		}

		if (invalidOwnerId) {
			var error = new Error();
			error.statusCode = 404;
			error.message = 'No instance with id ' + ownerId + ' found in memberIds';
			next(error);
		}
	};

	Group.prototype.sendEmailToGroup = function(req, message, next) {
		var senderId = req.accessToken.userId;
		var group = this;

		if (!message ||
			!isOwnerOrMember(senderId, group) ||
			!group._memberIds.length) return throwAuthError(next);

		var memberIds = group._memberIds.concat(group._ownerId);

		Group.app.models.Customer.find({
			where: {_id: {inq: memberIds}}
		}, function(err, members) {
			if (err) return next(err);

			var senderName;
			var recipients = [];

			members.forEach(function(member) {
				if (member._id.toString() == senderId) {
					senderName = member.firstName + ' ' + member.lastName;
				} else {
					recipients.push(member.email);
				}
			});

			var mailOptions = {
				from: 'Mastermind',
				to: recipients.join(', '),
				subject: 'Message from ' + senderName,
				text: message
			};

			mailer.sendMail(mailOptions, next);
		});
	};

	Group.prototype.sendEmailToMember = function(req, message, memberId, next) {
		var senderId = req.accessToken.userId.toString();
		var group = this;

		if (!message || senderId === memberId
			|| !isOwnerOrMember(senderId, group)
			|| !isOwnerOrMember(memberId, group)) return throwAuthError(next);

		Group.app.models.Customer.find({
			where: {_id: {inq: [senderId, memberId]}}
		}, function(err, members) {
			if (err) return next(err);

			var mailOptions = {
				from: 'Mastermind',
				to: '',
				subject: 'Message from ',
				text: message
			};

			members.forEach(function(member) {
				var mId = member._id.toString();

				if (mId === senderId) {
					mailOptions.subject += member.firstName + ' ' + member.lastName;
				} else if (mId === memberId) {
					mailOptions.to += member.email;
				}
			});

			mailer.sendMail(mailOptions, next);
		});
	};

	Group.prototype.inviteNewMembers = function(req, emails, request, next) {
		var senderId = req.accessToken.userId.toString();
		var group = this;

		emails = prepareEmails(emails);
		var haveFreeSpace = currentNumberMembers(group) < group.maxMembers;

		if (!emails || !request || !isOwnerOrMember(senderId, group)
			|| (group._ownerId != senderId && !group.memberCanInvite)
			|| !haveFreeSpace) {
			return throwAuthError(next);
		}

		mailer.sendMail({
			from: 'Mastermind',
			to: emails,
			subject: 'Invitation to join a group.',
			text: request
		}, next);
	};

	Group.prototype.requestToJoin = function(req, request, next) {
		var JoinRequest = Group.app.models.JoinRequest;
		var Customer = Group.app.models.Customer;
		var senderId = req.accessToken.userId.toString();
		var group = this;

		if (!request || isOwnerOrMember(senderId, group)) {
			return throwAuthError(next);
		}

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
					// if find another active request
					if (!created) return cb(authorizationError);
					cb();
				});
			},
			Customer.findById.bind(Customer, group._ownerId),
			function(customer, cb) {
				mailer.sendMail({
					from: 'Mastermind',
					to: customer.email,
					subject: 'Request to join the group.',
					text: request
				}, cb);
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

		if (!haveFreeSpace) return throwAuthError(next);

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
				if (!request) return cb(authorizationError);

				Customer.findById(request._ownerId, function(err, customer) {
					if (err) return cb(err);
					if (!customer) return cb(authorizationError);

					cb(null, request, customer);
				});
			},
			// Update models and notify request owner
			function(request, customer, cb) {
				async.series([
					function(callback) {
						request.approved = true;
						request.closed = true;
						request.save(callback);
					},
					function(callback) {
						group._memberIds.push(customer._id);
						group.save(callback);
					},
					function(callback) {
						mailer.sendMail({
							from: 'Mastermind',
							to: customer.email,
							subject: 'Your request to join the group.',
							text: 'You request to join ' + group.name + ' group was accepted.\n\nThanks'
						}, callback);
					}
				], cb);
			}
		], next);
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
				if (!request) return cb(authorizationError);

				Customer.findById(request._ownerId, function(err, customer) {
					if (err) return cb(err);
					if (!customer) return cb(authorizationError);

					cb(null, request, customer);
				});
			},
			// Update request model and notify request owner
			function(request, customer, cb) {
				request.approved = false;
				request.closed = true;

				request.save(function(err) {
					if (err) return cb(err);

					mailer.sendMail({
						from: 'Mastermind',
						to: customer.email,
						subject: 'Your request to join the group.',
						text: 'You request to join ' + group.name + ' group was rejected.\n\nThanks'
					}, cb);
				});
			}
		], next);
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
	// Validate roudLength field
	Group.beforeRemote('create', validateRoudLengthField);
	Group.beforeRemote('prototype.updateAttributes', validateRoudLengthField);
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

	function validateRoudLengthField(ctx, group, next) {
		var roudLength = ctx.req.body.sessionConf.roudLength;

		if (!Array.isArray(roudLength)) return next();

		var minLengthRound = 0;

		var round1 = roudLength[0] >= minLengthRound ? Number(roudLength[0]) : minLengthRound;
		var round2PartA = roudLength[1] >= minLengthRound ? Number(roudLength[1]) : minLengthRound;
		var round2PartB = roudLength[2] >= minLengthRound ? Number(roudLength[2]) : minLengthRound;
		var round3 = roudLength[3] >= minLengthRound ? Number(roudLength[3]) : minLengthRound;

		ctx.req.body.sessionConf.roudLength = [round1, round2PartA, round2PartB, round3];
		next();
	}

	function allowMembersLeaveGroup(ctx, group, next) {
		var groupId = ctx.req.params.id;
		var delUserId = ctx.req.params.fk;
		var userId = ctx.req.accessToken.userId;

		Group.findById(groupId, function(err, group) {
			if (err) return next(err);
			if (group._ownerId.toString() == userId) return next();

			var isMember = group._memberIds.some(function(id) {
				return id.toString() == userId
			});

			if (isMember && delUserId == userId) return next();

			throwAuthError(next);
		});
	}

	function excludePrivateGroups(ctx, modelInstance, next) {
		var userId = ctx.req.accessToken.userId;

		if (Array.isArray(ctx.result)) {
			var groups = ctx.result;

			for (var i = 0; i < groups.length; i++) {
				if (!groups[i].private) continue;

				if (!isOwnerOrMember(userId, groups[i])) {
					groups.splice(i, 1);
					i--;
				}
			}
		} else if(ctx.result.private && !isOwnerOrMember(userId, ctx.result)) {
			return throwAuthError(next);
		}

		next();
	}

	function checkIsGroupMember(ctx, modelInstance, next) {
		var groupId = ctx.req.params.id;
		var userId = ctx.req.accessToken.userId;

		Group.findById(groupId, function(err, group) {
			if (err) return next(err);

			if (group.private && !isOwnerOrMember(userId, group)) {
				return throwAuthError(next);
			}

			next();
		});
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

	function isOwnerOrMember(userId, group) {
		var isOwner = group._ownerId.toString() === userId.toString();
		var isMember = group._memberIds.some(function(id) {
			return id.toString() === userId.toString();
		});

		return isOwner || isMember;
	}

	function throwAuthError(next) {
		var error = new Error('Authorization Required');
		error.statusCode = 401;
		error.code = 'AUTHORIZATION_REQUIRED';
		next(error);
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
};