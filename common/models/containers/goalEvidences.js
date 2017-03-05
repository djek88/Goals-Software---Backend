var ApiError = require('../../../server/lib/error/Api-error');
var isOwnerOrMember = require('../group/group').isOwnerOrMember;

module.exports = function(GoalEvidences) {
	GoalEvidences.disableRemoteMethod('getContainers', true);
	GoalEvidences.disableRemoteMethod('createContainer', true);
	GoalEvidences.disableRemoteMethod('destroyContainer', true);
	GoalEvidences.disableRemoteMethod('getContainer', true);
	GoalEvidences.disableRemoteMethod('uploadStream', true);
	GoalEvidences.disableRemoteMethod('downloadStream', true);
	GoalEvidences.disableRemoteMethod('getFiles', true);
	GoalEvidences.disableRemoteMethod('getFile', true);
	GoalEvidences.disableRemoteMethod('removeFile', true);
	GoalEvidences.disableRemoteMethod('upload', true);

	GoalEvidences.beforeRemote('download', function(ctx, container, next) {
		var Goal = GoalEvidences.app.models.Goal;
		var Group = GoalEvidences.app.models.Group;
		var senderId = ctx.req.accessToken.userId;
		var goalId = ctx.req.params.container;

		Goal.findById(goalId, function(err, goal) {
			if (err) return next(err);
			if (!goal) return next(new ApiError(404, 'Goal not found!'));

			Group.findById(goal._groupId, function(err, group) {
				if (err) return next(err);
				if (!group) return next(new ApiError(404, 'Goal group not found!'));
				if (!isOwnerOrMember(senderId, group)) return next(new ApiError(403));

				next();
			});
		});
	});
};