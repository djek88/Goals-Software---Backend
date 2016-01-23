var loopback = require('loopback');
var ValidationError = loopback.ValidationError;

module.exports = function(Group) {
	var PENALTYAMOUNT = [2, 5, 10, 15, 20, 30, 50, 75, 100, 200, 1000, 2500, 5000];
	var GROUPTYPE = {
		1: 'Business',
		2: 'Investment',
		3: 'Personal Development',
		4: 'Health and Fithness',
		5: 'Other'
	};
	var groupWhiteList = Object.keys(GROUPTYPE).map(function (item) {
		return Number(item);
	});

	Group.validatesPresenceOf('_ownerId');
	Group.validatesInclusionOf('type', {in: groupWhiteList});
	Group.validatesInclusionOf('penalty', {in: PENALTYAMOUNT});
	Group.validate('maxMembers', function(err) {
		if (this.maxMembers < 1) err();
	});

	// Disable unnecessary methods
	Group.disableRemoteMethod('upsert', true);
	Group.disableRemoteMethod('__create__Members', false);
	Group.disableRemoteMethod('__delete__Members', false);
	Group.disableRemoteMethod('__updateById__Members', false);
	Group.disableRemoteMethod('__destroyById__Members', false);
	Group.disableRemoteMethod('__create__SessionConf', false);
	Group.disableRemoteMethod('__destroy__SessionConf', false);

	// Make sure _ownerId set properly
	Group.beforeRemote('create', setOwnerId);
	Group.beforeRemote('prototype.updateAttributes', setOwnerId);

	// Exclude private groups where user don't owner or member
	Group.afterRemote('findOne', deletePrivateGroups);
	Group.afterRemote('find', deletePrivateGroups);

	// Return private group only for owner and members
	Group.beforeRemote('findById', checkIsGroupMember);
	Group.beforeRemote('exists', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__LastSession', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__NextSession', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__Members', checkIsGroupMember);
	Group.beforeRemote('prototype.__findById__Members', checkIsGroupMember);
	Group.beforeRemote('prototype.__count__Members', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__Owner', checkIsGroupMember);
	Group.beforeRemote('prototype.__get__SessionConf', checkIsGroupMember);

	// Exclude protected fields from responce
	Group.afterRemote('prototype.__get__Members', excludeFields);
	Group.afterRemote('prototype.__findById__Members', excludeFields);
	Group.afterRemote('prototype.__get__Owner', excludeFields);

	function setOwnerId(ctx, group, next) {
		ctx.req.body._ownerId = ctx.req.accessToken.userId;
		next();
	}

	function deletePrivateGroups(ctx, modelInstance, next) {
		var userId = ctx.req.accessToken.userId;
		var groups = ctx.result;

		for (var i = 0; i < groups.length; i++) {
			if (!groups[i].private) continue;

			var isOwner = groups[i]._ownerId.toString() == userId;
			var isMember = groups[i]._memberIds.some(function(id) {
				return id.toString() == userId;
			});

			if (!isOwner && !isMember) {
				groups.splice(i, 1);
				i--;
			}
		}

		next();
	}

	function checkIsGroupMember(ctx, modelInstance, next) {
		var groupId = ctx.req.params.id;
		var userId = ctx.req.accessToken.userId;

		Group.findOne({
			where: {
				_id: groupId,
				or: [{_ownerId: userId}, {_memberIds: userId}]
			}
		}, function(err, result) {
			if (err || result) return next(err);

			var error = new Error();
			error.statusCode = 401;
			error.message = 'Authorization Required';
			error.code = 'AUTHORIZATION_REQUIRED';
			return next(error);
		});
	}

	function excludeFields(ctx, modelInstance, next) {
		var WHITE_LIST_FIELDS = ['_id', 'firstName', 'lastName', 'timeZone', 'description', 'avatar', 'social'];
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

		function changeModelByWhiteList(resource) {
			var destination = {};

			WHITE_LIST_FIELDS.forEach(function(field) {
				destination[field] = resource[field];
			});

			return destination;
		}
	}
};