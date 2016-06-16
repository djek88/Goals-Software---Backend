var languages = require('languages');
var _ = require('lodash');
var resources = require('../additional/resources');
var GROUPTYPES = resources.groupTypes;
var PENALTYAMOUNTS = resources.penaltyAmounts;
var SESSIONTIMETYPES = resources.sessionTimeTypes;

module.exports = function(GroupPreferences) {
	var minMaxFeeErrorMsg = 'Must contain only min and max value in array!';
	var sessionTimeTypesWhiteList = Object.keys(SESSIONTIMETYPES);
	var groupTypesWhiteList = Object.keys(GROUPTYPES).map(function (item) {
		return Number(item);
	});

	GroupPreferences.validatesInclusionOf('type', {in: groupTypesWhiteList});

	GroupPreferences.validatesLengthOf('joiningFee', {is: 2, message: {is: minMaxFeeErrorMsg}});
	GroupPreferences.validatesLengthOf('monthlyFee', {is: 2, message: {is: minMaxFeeErrorMsg}});
	GroupPreferences.validatesLengthOf('yearlyFee', {is: 2, message: {is: minMaxFeeErrorMsg}});
	GroupPreferences.validatesLengthOf('penaltyFee', {is: 2, message: {is: minMaxFeeErrorMsg}});
	GroupPreferences.validatesLengthOf('members', {is: 2, message: {is: minMaxFeeErrorMsg}});
	GroupPreferences.validatesLengthOf('availableTime', {is: 2, message: {is: minMaxFeeErrorMsg}});

	GroupPreferences.validate('joiningFee', function(err) {
		checkMinMax(this.joiningFee, 0, 10000, err);}, {message: 'min >= 0, max >= min, max <= 10000!'});
	GroupPreferences.validate('monthlyFee', function(err) {
		checkMinMax(this.monthlyFee, 0, 10000, err);}, {message: 'min >= 0, max >= min, max <= 10000!'});
	GroupPreferences.validate('yearlyFee', function(err) {
		checkMinMax(this.yearlyFee, 0, 100000, err);}, {message: 'min >= 0, max >= min, max <= 100000!'});
	GroupPreferences.validate('penaltyFee', function(err) {
		checkMinMax(this.penaltyFee, 0, 5000, err);}, {message: 'min >= 0, max >= min, max <= 5000!'});
	GroupPreferences.validate('members', function(err) {
		checkMinMax(this.members, 1, 1000, err);}, {message: 'min >= 1, max >= min, max <= 1000!'});

	GroupPreferences.validate('penaltyFee', validatePenalty, {message: 'Must be in range: ' + PENALTYAMOUNTS.join(', ')});
	GroupPreferences.validate('availableTime', validateAvailableTime, {message: 'Min < max, min and max must be in range: ' + sessionTimeTypesWhiteList.join(', ')});
	GroupPreferences.validate('languages', validateLanguages, {message: 'Must inclusion of: ' + languages.getAllLanguageCode().join(', ')});

	function checkMinMax(minMaxArray, minPossible, maxPossible, err) {
		var min = parseInt(minMaxArray[0], 10);
		var max = parseInt(minMaxArray[1], 10);

		if(isNaN(min) || isNaN(max)) return err();

		if (min < minPossible || max < min || max > maxPossible) err();
	}

	function validatePenalty(err) {
		var min = this.penaltyFee[0];
		var max = this.penaltyFee[1];

		if (PENALTYAMOUNTS.indexOf(min) < 0 ||
			PENALTYAMOUNTS.indexOf(max) < 0) err();
	}

	function validateAvailableTime(err) {
		var min = this.availableTime[0];
		var max = this.availableTime[1];

		if (sessionTimeTypesWhiteList.indexOf(min) < 0 ||
			sessionTimeTypesWhiteList.indexOf(max) < 0 ||
			Number(max) < Number(min)) err();
	}

	function validateLanguages(err) {
		this.languages = _.uniq(this.languages);

		for (var i = this.languages.length - 1; i >= 0; i--) {
			if(!languages.isValid(this.languages[i])) return err();
		}
	}
};