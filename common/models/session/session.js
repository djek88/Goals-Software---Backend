module.exports = function(Session) {
	Session.validatesPresenceOf('_groupId');

	Session.validate('startAt', function(err) {
		if (this.startAt <= new Date()) err();
	});

	// acls
	// 1)method find sesions must be allow for non authentical user.
}