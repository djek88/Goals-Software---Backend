/*var fs = require('fs');
var assert = require('chai').assert;
var async = require('async');
var server = require('../server/server');

var Customer = server.models.Customer;
var AccessToken = server.models.AccessToken;
var AvatarsContainer = server.models.AvatarsContainer;

var routeHelper = require('./lib/route-helper')(Customer);
var usersData = require('./resources/users');
var api;

describe('Customer model', function() {
	var firstUser = new Customer(usersData.firstUser);
	var secondUser = new Customer(usersData.secondUser);
	var fUserToken;

	before(function(done) {
		api = require('./apiClient');

		async.series([
			Customer.destroyAll.bind(Customer),
			AccessToken.destroyAll.bind(AccessToken),
			//save users in db
			function(cb) {
				async.each([firstUser, secondUser], function(item, callback) {
					item.save(function(err, result) {
						if (err) return callback(err);

						item = result;
						callback();
					});
				}, cb);
			},
			function(cb) {
				Customer.login({
					email: firstUser.email,
					password: firstUser.fhqSessionId
				}, function(err, result) {
					if (err) return cb(err);

					fUserToken = result.id;
					cb();
				});
			}
		], done);
	});

	describe('baseCustomerInfo', function() {
		describe('acls', function() {
			it('required authorization', function(done) {
				api
					.get(routeHelper('baseCustomerInfo', {id: firstUser._id}))
					.expect(401, done);
			});
		});

		it('status 200', function(done) {
			api
				.get(routeHelper('baseCustomerInfo', {id: firstUser._id}, fUserToken))
				.expect(200, function(err, res) {
					if (err) return done(err);

					assert.deepEqual(res.body, {
						_id: firstUser._id,
						firstName: firstUser.firstName,
						lastName: firstUser.lastName,
						description: firstUser.description,
						avatar: firstUser.avatar,
						social: JSON.parse(JSON.stringify(firstUser.social))
					});
					done()
				});
		});
	});

	describe('uploadAvatar', function() {
		var fileName = 'testFile.png';
		var pathToFile = './test/resources/';
		var avatarsFolder = './test/storage/avatars/';

		beforeEach(function(done) {
			async.series([
				reset.bind(null, firstUser),
				function(cb) {
					AvatarsContainer.getContainers(function (err, containers) {
						if (err) return cb(err);

						if (containers.some(function(c) {return c.name === firstUser._id;})) {
							return AvatarsContainer.destroyContainer(firstUser._id, cb);
						}
						cb();
					});
				}
			], done);
		});

		describe('acls', function() {
			it('required authorization', function(done) {
				api
					.post(routeHelper('uploadAvatar', {id: firstUser._id}))
					.attach('file', pathToFile + fileName)
					.expect(401, done);
			});

			it('deny if not owner', function(done) {
				api
					.post(routeHelper('uploadAvatar', {id: secondUser._id}, fUserToken))
					.attach('file', pathToFile + fileName)
					.expect(401, done);
			});
		});

		it('require file', function(done) {
			api
				.post(routeHelper('uploadAvatar', {id: firstUser._id}, fUserToken))
				.expect(400, done);
		});

		it('success save file', function(done) {
			api
				.post(routeHelper('uploadAvatar', {id: firstUser._id}, fUserToken))
				.attach('file', pathToFile + fileName)
				.expect(200, function(err, res){
					if (err) return done(err);

					fs.statSync(avatarsFolder + firstUser._id + '/' + fileName);
					done();
				});
		});

		it('afterRemote hook "set avatar field"', function(done) {
			api
				.post(routeHelper('uploadAvatar', {id: firstUser._id}, fUserToken))
				.attach('file', pathToFile + fileName)
				.expect(200, function(err, res){
					if (err) return done(err);

					Customer.findById(firstUser._id, function(err, result) {
						if (err) return done(err);

						assert.propertyVal(result, 'avatar', '/AvatarsContainers/' + firstUser._id + '/download/' + fileName);
						done();
					});
				});
		});
	});

	describe('updateAttributes', function() {
		beforeEach(function(done) {
			reset(firstUser, done);
		});

		it('beforeRemote hook "del properties"', function(done) {
			api
				.put(routeHelper('updateAttributes', {id: firstUser._id}, fUserToken))
				.send({
					_id: 'new_Id',
					_fhqSessionId: "new_fhqSessionId",
					email: "newemail",
					password: "newpassword",
					avatar: "newavatar"
				})
				.expect(200, function(err, res) {
					if (err) return done(err);

					Customer.findById(firstUser._id, function(err, result) {
						if (err) return done(err);
						if (!result) return done(new Error('Customer not found!'));

						assert.equal(result._id, firstUser._id);
						assert.equal(result._fhqSessionId, firstUser._fhqSessionId);
						assert.equal(result.email, firstUser.email);
						assert.equal(result.password, firstUser.password);
						assert.equal(result.avatar, firstUser.avatar);
						done();
					});
				});
		});
	});
});

function reset(instance, cb) {
	instance.updateAttributes(instance, cb);
}*/