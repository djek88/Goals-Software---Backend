var ValidationError = require('loopback').ValidationError;

module.exports = function(Group) {
	var PENALTYAMOUNT = [2, 5, 10, 15, 20, 30, 50, 75, 100, 200, 1000, 2500, 5000];
	var GROUPTYPE = {
		1: 'Business',
		2: 'Investment',
		3: 'Personal Development',
		4: 'Health and Fithness',
		5: 'Other'
	};
	var groupWhiteList = Object.keys(GROUPTYPE).map(function (item) {
		return Number(item);
	});

	Group.validatesUniquenessOf('name');
	Group.validatesPresenceOf('ownerId');
	Group.validatesInclusionOf('type', {in: groupWhiteList});
	Group.validatesInclusionOf('penalty', {in: PENALTYAMOUNT});

	Group.validate('maxMembers', function(err) {
		if (this.maxMembers < 1) err();
	});
};