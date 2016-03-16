module.exports = function(Vote) {
	Vote.validatesPresenceOf('_approverId');
};