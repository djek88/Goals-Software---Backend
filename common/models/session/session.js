module.exports = function(Session) {
	Session.validatesPresenceOf('groupId');

	Session.validate('startAt', function(err) {
		if (this.startAt <= new Date()) err();
	});
}