module.exports = function(JoinRequest) {
	JoinRequest.validatesPresenceOf('_ownerId', '_groupId');
};