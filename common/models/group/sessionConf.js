var SESSIONFREQUENCYTYPES = require('../additional/resources').sessionFrequencyTypes;

module.exports = function(SessionConf) {
	var frequencyTypeWhiteList = Object.keys(SESSIONFREQUENCYTYPES).map(function (item) {
		return Number(item);
	});

	SessionConf.validatesInclusionOf('frequencyType', {in: frequencyTypeWhiteList});
};