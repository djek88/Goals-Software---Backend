var ApiError = require('../../../server/lib/error/Api-error');
var isOwnerOrMember = require('../group/group').isOwnerOrMember;

module.exports = function(FilesContainer) {
	FilesContainer.disableRemoteMethod('getContainers', true);
	FilesContainer.disableRemoteMethod('createContainer', true);
	FilesContainer.disableRemoteMethod('destroyContainer', true);
	FilesContainer.disableRemoteMethod('getContainer', true);
	FilesContainer.disableRemoteMethod('uploadStream', true);
	FilesContainer.disableRemoteMethod('downloadStream', true);
	FilesContainer.disableRemoteMethod('getFiles', true);
	FilesContainer.disableRemoteMethod('getFile', true);
	FilesContainer.disableRemoteMethod('removeFile', true);
	FilesContainer.disableRemoteMethod('upload', true);

	FilesContainer.beforeRemote('download', function(ctx, container, next) {
		var Goal = FilesContainer.app.models.Goal;
		var Group = FilesContainer.app.models.Group;
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