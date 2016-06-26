var moment = require('moment-timezone');
var languages = require('languages');

var SESSIONFREQUENCYTYPES = require('../additional/resources').sessionFrequencyTypes;
var SESSIONDAYTYPES = require('../additional/resources').sessionDayTypes;
var SESSIONTIMETYPES = require('../additional/resources').sessionTimeTypes;
var COUNTRIESDATA = require('../additional/contries-data').countries;

module.exports = function(SessionConf) {
	var frequencyTypeWhiteList = Object.keys(SESSIONFREQUENCYTYPES).map(function (key) {
		return Number(key);
	});
	var dayTypeWhiteList = Object.keys(SESSIONDAYTYPES).map(function (key) {
		return Number(key);
	});

	SessionConf.validatesInclusionOf('language', {in: languages.getAllLanguageCode()});
	SessionConf.validatesInclusionOf('frequencyType', {in: frequencyTypeWhiteList});
	SessionConf.validatesInclusionOf('day', {in: dayTypeWhiteList});
	SessionConf.validatesInclusionOf('time', {in: Object.keys(SESSIONTIMETYPES)});
	SessionConf.validatesInclusionOf('timeZone', {in: moment.tz.names()});
	SessionConf.validatesLengthOf('roundLength', {is: 4});
	SessionConf.validate('roundLength', validateRoundLength, {message: 'Each round must be >= 0 sec'});
	SessionConf.validate('country', validateCountry, {message: 'Must inclusion of: ' + Object.keys(COUNTRIESDATA).join(', ')});
	SessionConf.validate('state', validateState, {message: 'State is invalid, required country'});
	SessionConf.validate('city', validateCity, {message: 'City is invalid, required state'});

	function validateRoundLength(err) {
		var minRoundLength = 0;

		if (this.roundLength[0] < minRoundLength ||
			this.roundLength[1] < minRoundLength ||
			this.roundLength[2] < minRoundLength ||
			this.roundLength[3] < minRoundLength) err();
	}

	function validateCountry(err) {
		if (this.country) {
			if (Object.keys(COUNTRIESDATA).indexOf(this.country) === -1) {
				return err();
			}
		}
	}

	function validateState(err) {
		if (this.state) {
			if (!this.country || Object.keys(COUNTRIESDATA[this.country].states)
				.indexOf(this.state) === -1) {
				return err();
			}
		}
	}

	function validateCity(err) {
		if (this.city) {
			if (!this.country || !this.state ||
				Object.keys(COUNTRIESDATA[this.country].states[this.state].cities)
				.indexOf(this.city) === -1) {
				return err();
			}
		}
	}
};