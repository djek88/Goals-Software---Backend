module.exports = function(GroupAvatars) {
	GroupAvatars.disableRemoteMethod('getContainers', true);
	GroupAvatars.disableRemoteMethod('createContainer', true);
	GroupAvatars.disableRemoteMethod('destroyContainer', true);
	GroupAvatars.disableRemoteMethod('getContainer', true);
	GroupAvatars.disableRemoteMethod('uploadStream', true);
	GroupAvatars.disableRemoteMethod('downloadStream', true);
	GroupAvatars.disableRemoteMethod('getFiles', true);
	GroupAvatars.disableRemoteMethod('getFile', true);
	GroupAvatars.disableRemoteMethod('removeFile', true);
	GroupAvatars.disableRemoteMethod('upload', true);
};
