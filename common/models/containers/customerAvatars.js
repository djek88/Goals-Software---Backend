module.exports = function(CustomerAvatars) {
	CustomerAvatars.disableRemoteMethod('getContainers', true);
	CustomerAvatars.disableRemoteMethod('createContainer', true);
	CustomerAvatars.disableRemoteMethod('destroyContainer', true);
	CustomerAvatars.disableRemoteMethod('getContainer', true);
	CustomerAvatars.disableRemoteMethod('uploadStream', true);
	CustomerAvatars.disableRemoteMethod('downloadStream', true);
	CustomerAvatars.disableRemoteMethod('getFiles', true);
	CustomerAvatars.disableRemoteMethod('getFile', true);
	CustomerAvatars.disableRemoteMethod('removeFile', true);
	CustomerAvatars.disableRemoteMethod('upload', true);
};
