var assert = require('chai').assert;
var server = require('../server/server.js');

var resource = require('../common/models/additional/resources');
var Additional = server.models.Additional;

var routeHelper = require('./lib/route-helper')(Additional);
var api;

describe('Additional model', function() {
	before(function() {
		api = require('./apiClient');
	});

	describe('sessionFrequencyTypes', function() {
		it('status 200', function(done) {
			api
				.get(routeHelper('sessionFrequencyTypes'))
				.expect(200, function(err, res) {
					assert.deepEqual(res.body, resource.sessionFrequencyTypes);
					done();
				});
		});
	});

	describe('groupTypes', function() {
		it('status 200', function(done) {
			api
				.get(routeHelper('groupTypes'))
				.expect(200, function(err, res) {
					assert.deepEqual(res.body, resource.groupTypes);
					done();
				});
		});
	});

	describe('penaltyAmounts', function() {
		it('status 200', function(done) {
			api
				.get(routeHelper('penaltyAmounts'))
				.expect(200, function(err, res) {
					assert.deepEqual(res.body, resource.penaltyAmounts);
					done();
				});
		});
	});

	describe('sessionDayTypes', function() {
		it('status 200', function(done) {
			api
				.get(routeHelper('sessionDayTypes'))
				.expect(200, function(err, res) {
					assert.deepEqual(res.body, resource.sessionDayTypes);
					done();
				});
		});
	});

	describe('sessionTimeTypes', function() {
		it('status 200', function(done) {
			api
				.get(routeHelper('sessionTimeTypes'))
				.expect(200, function(err, res) {
					assert.deepEqual(res.body, resource.sessionTimeTypes);
					done();
				});
		});
	});

	describe('evidenceSupportedTypes', function() {
		it('status 200', function(done) {
			api
				.get(routeHelper('evidenceSupportedTypes'))
				.expect(200, function(err, res) {
					assert.deepEqual(res.body, resource.evidenceSupportedTypes);
					done();
				});
		});
	});
});