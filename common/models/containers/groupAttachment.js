module.exports = function(GroupAttachment) {
	GroupAttachment.disableRemoteMethod('getContainers', true);
	GroupAttachment.disableRemoteMethod('createContainer', true);
	GroupAttachment.disableRemoteMethod('destroyContainer', true);
	GroupAttachment.disableRemoteMethod('getContainer', true);
	GroupAttachment.disableRemoteMethod('uploadStream', true);
	GroupAttachment.disableRemoteMethod('downloadStream', true);
	GroupAttachment.disableRemoteMethod('getFiles', true);
	GroupAttachment.disableRemoteMethod('getFile', true);
	GroupAttachment.disableRemoteMethod('removeFile', true);
	GroupAttachment.disableRemoteMethod('upload', true);
};
