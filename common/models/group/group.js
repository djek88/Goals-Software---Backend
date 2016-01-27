var resources = require('../additional/resources');
var PENALTYAMOUNTS = resources.penaltyAmounts;
var GROUPTYPES = resources.groupTypes;

module.exports = function(Group) {
	var groupTypeWhiteList = Object.keys(GROUPTYPES).map(function (item) {
		return Number(item);
	});

	Group.validatesPresenceOf('_ownerId');
	Group.validatesInclusionOf('type', {in: groupTypeWhiteList});
	Group.validatesInclusionOf('penalty', {in: PENALTYAMOUNTS});
	Group.validate('maxMembers', function(err) { if (this.maxMembers < 1) err(); });

	// Change group owner request
	Group.remoteMethod('changeGroupOwner', {
		isStatic: false,
		description: 'Change group owner.',
		http: {path: '/change-owner/:ownerId', verb: 'put'},
		accepts: [
			{arg: 'ownerId', type: 'string', description: 'New owner id', required: true}
		],
		returns: {arg: 'group', type: 'object'}
	});

	Group.prototype.changeGroupOwner = function(ownerId, next) {
		var newOwnerId = ownerId;
		var invalidOwnerId = true;

		for (var i = this._memberIds.length - 1; i >= 0; i--) {
			var id = this._memberIds[i].toString();

			if (id === newOwnerId) {
				invalidOwnerId = false;

				this._memberIds.splice(i, 1);
				this._ownerId = id;
				this.save(next);
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

	// Disable unnecessary methods
	Group.disableRemoteMethod('upsert', true);
	Group.disableRemoteMethod('__create__Members', false);
	Group.disableRemoteMethod('__delete__Members', false);
	Group.disableRemoteMethod('__updateById__Members', false);
	Group.disableRemoteMethod('__destroyById__Members', false);
	Group.disableRemoteMethod('__link__Members', false);
	Group.disableRemoteMethod('__create__SessionConf', false);
	Group.disableRemoteMethod('__destroy__SessionConf', false);


	// Make sure _ownerId set properly
	Group.beforeRemote('create', setOwnerId);
	Group.beforeRemote('prototype.updateAttributes', setOwnerId);

	// Deny add members to group during create or update group model
	Group.beforeRemote('create', excludeMemberIdsField);
	Group.beforeRemote('prototype.updateAttributes', excludeMemberIdsField);

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


	function setOwnerId(ctx, group, next) {
		ctx.req.body._ownerId = ctx.req.accessToken.userId;
		next();
	}

	function excludeMemberIdsField(ctx, group, next) {
		delete ctx.req.body._memberIds;
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

			var error = new Error();
			error.statusCode = 401;
			error.message = 'Authorization Required';
			error.code = 'AUTHORIZATION_REQUIRED';
			next(error);
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
				var error = new Error();
				error.statusCode = 401;
				error.message = 'Authorization Required';
				error.code = 'AUTHORIZATION_REQUIRED';
				return next(error);
		}

		next();
	}

	function checkIsGroupMember(ctx, modelInstance, next) {
		var groupId = ctx.req.params.id;
		var userId = ctx.req.accessToken.userId;

		Group.findById(groupId, function(err, group) {
			if (err) return next(err);

			if (group.private && !isOwnerOrMember(userId, group)) {
				var error = new Error();
				error.statusCode = 401;
				error.message = 'Authorization Required';
				error.code = 'AUTHORIZATION_REQUIRED';
				return next(error);
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
		var isOwner = group._ownerId.toString() == userId;
		var isMember = group._memberIds.some(function(id) {
			return id.toString() == userId;
		});

		return isOwner || isMember;
	}
};