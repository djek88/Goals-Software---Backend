var moment = require('moment-timezone');

var SESSIONFREQUENCYTYPES = require('../additional/resources').sessionFrequencyTypes;
var SESSIONDAYTYPES = require('../additional/resources').sessionDayTypes;
var SESSIONTIMETYPES = require('../additional/resources').sessionTimeTypes;

module.exports = function(SessionConf) {
	var frequencyTypeWhiteList = Object.keys(SESSIONFREQUENCYTYPES).map(function (key) {
		return Number(key);
	});
	var dayTypeWhiteList = Object.keys(SESSIONDAYTYPES).map(function (key) {
		return Number(key);
	});

	SessionConf.validatesInclusionOf('frequencyType', {in: frequencyTypeWhiteList});
	SessionConf.validatesInclusionOf('day', {in: dayTypeWhiteList});
	SessionConf.validatesInclusionOf('time', {in: Object.keys(SESSIONTIMETYPES)});
	SessionConf.validatesInclusionOf('timeZone', {in: moment.tz.names()});
};