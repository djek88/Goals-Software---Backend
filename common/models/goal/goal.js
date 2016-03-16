var ApiError = require('../../../server/lib/error/Api-error');
var GOALSTATES = require('../additional/resources').goalStates;
var isOwnerOrMember = require('../group/group').isOwnerOrMember;

module.exports = function(Goal) {
	Goal.validatesPresenceOf('_ownerId', '_groupId');
	Goal.validatesInclusionOf('state', {in: GOALSTATES});
	Goal.validate('dueDate', function(err) { if (this.dueDate <= new Date()) err(); });

	// Disable unnecessary methods
	Goal.disableRemoteMethod('upsert', true);
	Goal.disableRemoteMethod('deleteById', true);
	Goal.disableRemoteMethod('__delete__Votes', false);
	Goal.disableRemoteMethod('__updateById__Votes', false);
	Goal.disableRemoteMethod('__destroyById__Votes', false);
	Goal.disableRemoteMethod('__findById__Votes', false);
	Goal.disableRemoteMethod('__destroyById__Votes', false);

	// Deny set manualy id field
	Goal.beforeRemote('create', delId);
	Goal.beforeRemote('prototype.updateAttributes', delId);
	// Make sure _ownerId set properly
	Goal.beforeRemote('create', setOwnerId);
	Goal.beforeRemote('prototype.updateAttributes', setOwnerId);
	// Make sure _groupId set properly
	Goal.beforeRemote('create', checkGroupId);
	Goal.beforeRemote('prototype.updateAttributes', checkGroupId);
	// Deny set manualy state, evidences, comments
	Goal.beforeRemote('create', delStateEvidencesCommentsVotes);
	Goal.beforeRemote('prototype.updateAttributes', delStateEvidencesCommentsVotes);

	// Allow get goal for owner and group member

	function delId(ctx, goal, next) {
		delete ctx.req.body._id;
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

	function delStateEvidencesCommentsVotes(ctx, goal, next) {
		delete ctx.req.body.state;
		delete ctx.req.body.evidences;
		delete ctx.req.body.comments;
		delete ctx.req.body.votes;
		next();
	}
};