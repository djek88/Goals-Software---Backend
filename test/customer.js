/*var fs = require('fs');
var assert = require('chai').assert;
var async = require('async');
var server = require('../server/server');

var Customer = server.models.Customer;
var AccessToken = server.models.AccessToken;
var CustomerAvatars = server.models.CustomerAvatars;

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
						timeZone: firstUser.timeZone,
						visitSeveralGroups: firstUser.visitSeveralGroups,
						social: JSON.parse(JSON.stringify(firstUser.social)),
						groupPreferences: JSON.parse(JSON.stringify(firstUser.groupPreferences))
					});
					done()
				});
		});
	});

	describe('uploadAvatar', function() {
		var fileName = 'testFile.png';
		var pathToFile = './test/resources/';
		var avatarsFolder = './test/storage/customerAvatars/';

		beforeEach(function(done) {
			async.series([
				reset.bind(null, firstUser),
				function(cb) {
					CustomerAvatars.getContainers(function (err, containers) {
						if (err) return cb(err);

						if (containers.some(function(c) {return c.name === firstUser._id;})) {
							return CustomerAvatars.destroyContainer(firstUser._id, cb);
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

		it('success save file, update model, valid responce', function(done) {
			api
				.post(routeHelper('uploadAvatar', {id: firstUser._id}, fUserToken))
				.attach('file', pathToFile + fileName)
				.expect(200, function(err, res){
					if (err) return done(err);

					// check file exist
					fs.statSync(avatarsFolder + firstUser._id + '/' + fileName);

					Customer.findById(firstUser._id, function(err, result) {
						if (err) return done(err);

						// check update model
						assert.propertyVal(result, 'avatar', '/CustomerAvatars/' + firstUser._id + '/download/' + fileName);
						// check responce
						assert.deepEqual(res.body, modelToObj(result));
						done();
					});
				});
		});
	});

	describe('updateAttributes', function() {
		beforeEach(function(done) {
			reset(firstUser, done);
		});

		it('success updated, valid responce', function(done) {
			var newData = {
				firstName: 'newfirstName',
				lastName: 'newlastName',
				description: 'newdescription',
				timeZone: 'UTC',
				visitSeveralGroups: true,
				social: {
					fb: 'newfb',
					tw: 'newtw',
					li: 'newli',
					wb: 'newwb',
				},
				balance: {
					USD: 100,
				},
				groupPreferences:{
					type: 1,
					joiningFee: [1, 2],
					monthlyFee: [3, 4],
					yearlyFee: [5, 6],
					penaltyFee: [50, 100],
					members: [2, 4],
					availableTime: ["1.00", "3.00"],
					languages: ["aa"]
				}
			};

			api
				.put(routeHelper('updateAttributes', {id: firstUser._id}, fUserToken))
				.send(newData)
				.expect(200, function(err, res) {
					if(err) return done(err);

					Customer.findById(firstUser._id, function(err, result) {
						if (err) return done(err);

						result = modelToObj(result)

						assert.deepEqual(res.body, result);

						assert.equal(newData.firstName, result.firstName);
						assert.equal(newData.lastName, result.lastName);
						assert.equal(newData.description, result.description);
						assert.equal(newData.timeZone, result.timeZone);
						assert.equal(newData.visitSeveralGroups, result.visitSeveralGroups);
						assert.deepEqual(newData.social, result.social);
						assert.deepEqual(newData.balance, result.balance);
						assert.deepEqual(newData.groupPreferences, result.groupPreferences);
						done();
					});
				});
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

	function modelToObj(model) {
		return JSON.parse(JSON.stringify(model));
	}
});

function reset(instance, cb) {
	instance.updateAttributes(instance, cb);
}*/