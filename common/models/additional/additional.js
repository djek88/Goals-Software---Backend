var resources = require('./resources');

module.exports = function(Additional) {
	Additional.remoteMethod('sessionFrequencyTypes', {
		description: 'Return session frequency types.',
		http: {path: '/session-frequency-types', verb: 'get'},
		accepts: [],
		returns: {arg: 'types', type: 'object'}
	});

	Additional.remoteMethod('groupTypes', {
		description: 'Return group types.',
		http: {path: '/group-types', verb: 'get'},
		accepts: [],
		returns: {arg: 'types', type: 'object'}
	});

	Additional.remoteMethod('penaltyAmounts', {
		description: 'Return penalty amounts.',
		http: {path: '/penalty-amounts', verb: 'get'},
		accepts: [],
		returns: {arg: 'types', type: 'object'}
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
};