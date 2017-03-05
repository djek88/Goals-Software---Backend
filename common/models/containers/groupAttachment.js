module.exports = function(GroupAttachments) {
	GroupAttachments.disableRemoteMethod('getContainers', true);
	GroupAttachments.disableRemoteMethod('createContainer', true);
	GroupAttachments.disableRemoteMethod('destroyContainer', true);
	GroupAttachments.disableRemoteMethod('getContainer', true);
	GroupAttachments.disableRemoteMethod('uploadStream', true);
	GroupAttachments.disableRemoteMethod('downloadStream', true);
	GroupAttachments.disableRemoteMethod('getFiles', true);
	GroupAttachments.disableRemoteMethod('getFile', true);
	GroupAttachments.disableRemoteMethod('removeFile', true);
	GroupAttachments.disableRemoteMethod('upload', true);
};
