module.exports = function(Goal) {
	var GOALSTATES = [1, 2, 3, 4, 5, 6];

	Goal.validatesPresenceOf('ownerId', 'groupId');
	Goal.validatesInclusionOf('state', {in: GOALSTATES});
	
	Goal.validate('dueDate', function(err) {
		if (this.dueDate <= new Date()) err();
	});
};