module.exports = function(AvatarsContainer) {
	AvatarsContainer.disableRemoteMethod('getContainers', true);
	AvatarsContainer.disableRemoteMethod('createContainer', true);
	AvatarsContainer.disableRemoteMethod('destroyContainer', true);
	AvatarsContainer.disableRemoteMethod('getContainer', true);
	AvatarsContainer.disableRemoteMethod('uploadStream', true);
	AvatarsContainer.disableRemoteMethod('downloadStream', true);
	AvatarsContainer.disableRemoteMethod('getFiles', true);
	AvatarsContainer.disableRemoteMethod('getFile', true);
	AvatarsContainer.disableRemoteMethod('removeFile', true);
	AvatarsContainer.disableRemoteMethod('upload', true);
};
