var GOALSTATES = require('../additional/resources').goalStates;

module.exports = function(Goal) {
	Goal.validatesPresenceOf('_ownerId', '_groupId');
	Goal.validatesInclusionOf('state', {in: GOALSTATES});
	
	Goal.validate('dueDate', function(err) {
		if (this.dueDate <= new Date()) err();
	});
};