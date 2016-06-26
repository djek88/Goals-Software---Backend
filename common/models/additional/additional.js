var ApiError = require('../../../server/lib/error/Api-error');
var resources = require('./resources');
var countriesData = require('./contries-data').countries;

module.exports = function(Additional) {
	Additional.remoteMethod('sessionFrequencyTypes', {
		description: 'Return session frequency types.',
		http: {path: '/session-frequency-types', verb: 'get'},
		accepts: [],
		returns: {type: 'object', root: true}
	});

	Additional.remoteMethod('groupTypes', {
		description: 'Return group types.',
		http: {path: '/group-types', verb: 'get'},
		accepts: [],
		returns: {type: 'object', root: true}
	});

	Additional.remoteMethod('penaltyAmounts', {
		description: 'Return penalty amounts.',
		http: {path: '/penalty-amounts', verb: 'get'},
		accepts: [],
		returns: {type: 'array', root: true}
	});

	Additional.remoteMethod('sessionDayTypes', {
		description: 'Return session day types.',
		http: {path: '/session-day-types', verb: 'get'},
		accepts: [],
		returns: {type: 'object', root: true}
	});

	Additional.remoteMethod('sessionTimeTypes', {
		description: 'Return session time types.',
		http: {path: '/session-time-types', verb: 'get'},
		accepts: [],
		returns: {type: 'object', root: true}
	});

	Additional.remoteMethod('evidenceSupportedTypes', {
		description: 'Return evidences supported file types.',
		http: {path: '/evidence-supported-types', verb: 'get'},
		accepts: [],
		returns: {type: 'object', root: true}
	});

	Additional.remoteMethod('supportedCountries', {
		description: 'Return data about country.',
		http: {path: '/contries-data', verb: 'get'},
		accepts: [
			{arg: 'countryId', type: 'number', description: 'Country id'},
			{arg: 'stateId', type: 'number', description: 'State id'}
		],
		returns: {type: 'array', root: true}
	});

	Additional.sessionFrequencyTypes = function(next) {
		next(null, resources.sessionFrequencyTypes);
	};

	Additional.groupTypes = function(next) {
		next(null, resources.groupTypes);
	};

	Additional.penaltyAmounts = function(next) {
		next(null, resources.penaltyAmounts);
	};

	Additional.sessionDayTypes = function(next) {
		next(null, resources.sessionDayTypes);
	};

	Additional.sessionTimeTypes = function(next) {
		next(null, resources.sessionTimeTypes);
	};

	Additional.evidenceSupportedTypes = function(next) {
		next(null, resources.evidenceSupportedTypes);
	};

	Additional.supportedCountries = function(countryId, stateId, next) {
		var results = [];

		if (countryId) {
			if (!countriesData[countryId]) {
				return next(new ApiError(404, 'Country not found'));
			}

			if (stateId) {
				if (!countriesData[countryId].states[stateId]) {
					return next(new ApiError(404, 'State not found'));
				}

				// return cities by countryId and stateId
				fillResults(countriesData[countryId].states[stateId].cities);
			} else {
				// return states by countryId
				fillResults(countriesData[countryId].states);
			}
		} else {
			// return countries
			fillResults(countriesData);
		}

		next(null, results);

		function fillResults(objData) {
			for (var key in objData) {
				results.push({
					id: key,
					name: objData[key].name || objData[key]
				});
			}
		}
	};
};