var fs = require('fs');
var _ = require('lodash');
var assert = require('chai').assert;
var async = require('async');
var server = require('../server/server');

var Customer = server.models.Customer;
var AccessToken = server.models.AccessToken;
var Group = server.models.Group;
var Session = server.models.Session;

var usersData = require('./resources/users');
var routeHelper = require('./lib/route-helper')(Group);
var api;

describe('Group model', function() {
	var groupOwner = new Customer(usersData.firstUser);
	var fMember = new Customer(usersData.secondUser);
	var sMember = new Customer(usersData.thirdUser);
	var notMember = new Customer(usersData.fourthUser);

	var ownerToken;
	var fMemberToken;
	var sMemberToken;
	var notMemberToken;

	before(function(done) {
		api = require('./apiClient');

		async.series([
			Customer.destroyAll.bind(Customer),
			AccessToken.destroyAll.bind(AccessToken),
			Group.destroyAll.bind(Group),
			// save users in db
			function(cb) {
				async.each([groupOwner, fMember, sMember, notMember], function(item, callback) {
					item.save(function(err, result) {
						if (err) return callback(err);

						item = result;
						callback();
					});
				}, cb);
			},
			// create ownerToken
			function(cb) {
				Customer.login({
					email: groupOwner.email,
					password: groupOwner.fhqSessionId
				}, function(err, result) {
					if (err) return cb(err);

					ownerToken = result.id;
					cb();
				});
			},
			// create fMemberToken
			function(cb) {
				Customer.login({
					email: fMember.email,
					password: fMember.fhqSessionId
				}, function(err, result) {
					if (err) return cb(err);

					fMemberToken = result.id;
					cb();
				});
			},
			// create sMemberToken
			function(cb) {
				Customer.login({
					email: sMember.email,
					password: sMember.fhqSessionId
				}, function(err, result) {
					if (err) return cb(err);

					sMemberToken = result.id;
					cb();
				});
			},
			// create notMemberToken
			function(cb) {
				Customer.login({
					email: notMember.email,
					password: notMember.fhqSessionId
				}, function(err, result) {
					if (err) return cb(err);

					notMemberToken = result.id;
					cb();
				});
			}
		], done);
	});

	describe('create', function() {
		var curGroup = {
			name: 'name'
		};

		beforeEach(function(done) {
			Group.destroyAll(done);
		});

		it('success create, valid responce', function(done) {
			api
				.post(routeHelper('create', ownerToken))
				.send(curGroup)
				.expect(200, function(err, res) {
					if (err) return done(err);

					Group.findById(res.body._id, function(err, result) {
						if (err) return done(err);

						assert.deepEqual(res.body, modelToObj(result));
						done();
					});
				});
		});

		it('beforeRemote hook "excludeIdMemberIdsSessionsFields"', function(done) {
			var extraData = {
				_id: 'wrongId',
				_memberIds: [fMember._id, sMember._id],
				_nextSessionId: 'wrongId',
				_lastSessionId: 'wrongId'
			};
			var newGroupData = _.assign({}, curGroup, extraData);

			api
				.post(routeHelper('create', ownerToken))
				.send(newGroupData)
				.expect(200, groupNotExist.bind(null, newGroupData, done));
		});

		it('beforeRemote hook "setOwnerId"', function(done) {
			var extraData = {_ownerId: 'wrongId'};
			var newGroupData = _.assign({}, curGroup, extraData);

			api
				.post(routeHelper('create', ownerToken))
				.send(newGroupData)
				.expect(200, function(err, res) {
					if (err) return done(err);

					Group.findById(res.body._id, function(err, result) {
						if (err) return done(err);

						assert.notEqual(newGroupData._ownerId, result._ownerId);
						assert.equal(groupOwner._id, result._ownerId);
						done();
					});
				});
		});

		it('beforeRemote hook "validateRoundLengthField"', function(done) {
			var extraData = {
				"sessionConf" : {
					"sheduled" : true,
					"roundLength" : [-1, -1, -1, -1]
				}
			};
			var newGroupData = _.assign({}, curGroup, extraData);

			api
				.post(routeHelper('create', ownerToken))
				.send(newGroupData)
				.expect(200, function(err, res) {
					if (err) return done(err);

					Group.findById(res.body._id, function(err, result) {
						if (err) return done(err);

						assert.notEqual(newGroupData.sessionConf.roundLength, result.sessionConf.roundLength);
						assert.deepEqual([0, 0, 0, 0], modelToObj(result.sessionConf.roundLength));
						done();
					});
				});
		});

		describe('afterRemote hook "createNextSession"', function() {
			beforeEach(function(done) {
				Session.destroyAll(done);
			});

			it('success create session', function(done) {
				api
					.post(routeHelper('create', ownerToken))
					.send(curGroup)
					.expect(200, function(err, res) {
						if (err) return done(err);

						Group.findById(res.body._id, function(err, group) {
							if (err) return done(err);

							Session.find({}, function(err, results) {
								if (err) return done(err);

								assert.lengthOf(results, 1);

								group = modelToObj(group);
								session = modelToObj(results[0]);

								assert.equal(session._id, group._nextSessionId);
								assert.equal(session._groupId, group._id);
								done();
							});
						});
					});
			});

			it('don\'t create session if manually scheduled', function(done) {
				var extraData = {
					"sessionConf" : {
						"sheduled" : false
					}
				};
				var newGroupData = _.assign({}, curGroup, extraData);

				api
					.post(routeHelper('create', ownerToken))
					.send(newGroupData)
					.expect(200, function(err, res) {
						if (err) return done(err);

						Group.findById(res.body._id, function(err, group) {
							if (err) return done(err);

							assert.isUndefined(group._nextSessionId);

							Session.find({}, function(err, results) {
								if (err) return done(err);

								assert.lengthOf(results, 0);
								done();
							});
						});
					});
			});
		});

		describe('acls', function() {
			it('required authorization', function(done) {
				api
					.post(routeHelper('create'))
					.send(curGroup)
					.expect(401, groupNotExist.bind(null, curGroup, done));
			});
		});

		function groupNotExist(group, done, err, res) {
			if (err) return done(err);

			Group.find({where: group}, function(err, results) {
				if (err) return done(err);

				assert.lengthOf(results, 0);
				done(null, res);
			});
		}
	});

	describe('find', function() {
		var privateGroups = 43;
		var publicGroups = 88;
		var privateGroupsWhereIsOwner = 22;
		var privateGroupsWhereIsMember = 77;

		beforeEach(function(done) {
			Group.destroyAll(function(err) {
				if (err) return done(err);

				async.parallel([
					// create private groups
					function(cb) {
						async.forEachOf(new Array(privateGroups), function(item, key, callback) {
							Group.create({
								name: 'name',
								_ownerId: notMember._id,
								private: true
							}, callback);
						}, cb);
					},
					// create public groups
					function(cb) {
						async.forEachOf(new Array(publicGroups), function(item, key, callback) {
							Group.create({
								name: 'name',
								_ownerId: notMember._id,
								private: false
							}, callback);
						}, cb);
					},
					// create private groups where is owner
					function(cb) {
						async.forEachOf(new Array(privateGroupsWhereIsOwner), function(item, key, callback) {
							Group.create({
								name: 'name',
								_ownerId: groupOwner._id,
								private: true
							}, callback);
						}, cb);
					},
					// create private groups where is member
					function(cb) {
						async.forEachOf(new Array(privateGroupsWhereIsMember), function(item, key, callback) {
							Group.create({
								name: 'name',
								_ownerId: notMember._id,
								_memberIds: [groupOwner._id],
								private: true
							}, callback);
						}, cb);
					}
				], done);
			});
		});

		it('afterRemote hook "excludePrivateGroups"', function(done) {
			api
				.get(routeHelper('find', ownerToken))
				.expect(200, function(err, res) {
					if(err) return done(err);

					assert.equal(
						publicGroups + privateGroupsWhereIsOwner + privateGroupsWhereIsMember,
						res.body.length
					);

					// all goals belong to the group owner
					for (var i = res.body.length - 1; i >= 0; i--) {
						var group = res.body[i];

						if (group.private) {
							assert.include(group._memberIds.concat(group._ownerId), groupOwner._id);
						}
					}

					done();
				});
		});
	});

	describe('transactions with instance', function() {
		var curGroup = {
			name: 'firstTestGroup',
			_ownerId: groupOwner._id,
			_memberIds: [fMember._id, sMember._id],
			sessionConf: {sheduled: false}
		};

		beforeEach(function(done) {
			async.series([
				Group.destroyAll.bind(Group),
				// create goal
				function(cb) {
					Group.create(curGroup, function(err, result) {
						if(err) return cb(err);

						curGroup = modelToObj(result);
						cb();
					});
				}
			], done);
		});

		describe('updateAttributes', function() {
			it('status 200', function(done) {
				var newData = {
					name: 'newName',
					description: 'newDesc'
				};

				api
					.put(routeHelper('updateAttributes', {id: curGoal._id}, ownerToken))
					.send(newData)
					.expect(200, function(err, res) {
						if(err) return done(err);

						Goal.findById(curGoal._id, function(err, result) {
							if (err) return done(err);

							assert.equal(result.name, newData.name);
							assert.equal(result.description, newData.description);
							done();
						});
					});
			});

			/*it('beforeRemote hook "delIdStateEvidencesFeedbacksVotes"', function(done) {
				var newData = {
					_id: 'wrongId',
					state: 2,
					evidences: [1, 2],
					feedbacks: [3, 4],
					votes: [5, 6]
				};

				api
					.put(routeHelper('updateAttributes', {id: curGoal._id}, ownerToken))
					.send(newData)
					.expect(200, function(err, res) {
						if (err) return done(err);

						Goal.findById(res.body._id, function(err, result) {
							if (err) return done(err);

							assert.notEqual(newData._id, result._id);
							assert.notEqual(newData.state, result.state);
							assert.notEqual(newData.evidences, result.evidences);
							assert.notEqual(newData.feedbacks, result.feedbacks);
							assert.notEqual(newData.votes, result.votes);
							done();
						});
					});
			});

			it('beforeRemote hook "delDueDateGroupId"', function(done) {
				var newData = {
					dueDate: Date.now() + 5*24*60*60*1000, // in 10 days
					_groupId: 'new' + group._id
				};

				api
					.put(routeHelper('updateAttributes', {id: curGoal._id}, ownerToken))
					.send(newData)
					.expect(200, function(err, res) {
						if (err) return done(err);

						Goal.findById(res.body._id, function(err, result) {
							if (err) return done(err);

							assert.notEqual(newData.dueDate, result.dueDate);
							assert.notEqual(newData._groupId, result._groupId);
							done();
						});
					});
			});

			it('beforeRemote hook "setOwnerId"', function(done) {
				var newData = {
					_ownerId: 'new' + groupOwner._id
				};

				api
					.put(routeHelper('updateAttributes', {id: curGoal._id}, ownerToken))
					.send(newData)
					.expect(200, function(err, res) {
						if (err) return done(err);

						Goal.findById(res.body._id, function(err, result) {
							if (err) return done(err);

							assert.notEqual(newData._ownerId, result._ownerId);
							assert.equal(groupOwner._id, result._ownerId);
							done();
						});
					});
			});

			it('beforeRemote hook "denyIfDueDateReached"', function(done) {
				async.series([
					// prepare goal
					function(cb) {
						var expiredDate = Date.now() - 24*60*60*1000;

						Goal.updateAll({
								_id: curGoal._id
							}, {
								dueDate: expiredDate
							},
							function(err, info) {
								cb(err);
								assert.equal(1, info.count);
							});
					},
					function(cb) {
						var newData = {name: 'newName'};

						api
							.put(routeHelper('updateAttributes', {id: curGoal._id}, ownerToken))
							.send(newData)
							.expect(403, function(err, res) {
								if (err) return done(err);

								Goal.findById(curGoal._id, function(err, result) {
									if (err) return done(err);

									assert.notEqual(result.name, newData.name);
									done();
								});
							});
					}
				], done);
			});

			describe('acls', function() {
				it('required authorization', function(done) {
					api
						.put(routeHelper('updateAttributes', {id: curGoal._id}))
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});
			});*/
		});

		describe('findById, findOne', function() {
			// make group private
			beforeEach(function(done) {
				Group.updateAll({
						_id: curGroup._id
					}, {
						private: true
					},
					function(err, info) {
						done(err);
						assert.equal(1, info.count);
					});
			});

			describe('findById afterRemote hook "excludePrivateGroups"', function(done) {
				it('success if owner', function(done) {
					api
						.get(routeHelper('findById', {id: curGroup._id}, ownerToken))
						.expect(200, function(err, res) {
							if (err) return done(err);

							assert.equal(res.body._id, curGroup._id);
							done();
						});
				});

				it('success if member', function(done) {
					api
						.get(routeHelper('findById', {id: curGroup._id}, fMemberToken))
						.expect(200, function(err, res) {
							if (err) return done(err);

							assert.equal(res.body._id, curGroup._id);
							done();
						});
				});

				it('forbidden if not member or owner', function(done) {
					api
						.get(routeHelper('findById', {id: curGroup._id}, notMemberToken))
						.expect(403, done);
				});
			});

			describe('findOne afterRemote hook "excludePrivateGroups"', function(done) {
				it('success if owner', function(done) {
					api
						.get(routeHelper('findOne', ownerToken))
						.send({where: {_id: curGroup._id}})
						.expect(200, function(err, res) {
							if (err) return done(err);

							assert.equal(res.body._id, curGroup._id);
							done();
						});
				});

				it('success if member', function(done) {
					api
						.get(routeHelper('findOne', fMemberToken))
						.send({where: {_id: curGroup._id}})
						.expect(200, function(err, res) {
							if (err) return done(err);

							assert.equal(res.body._id, curGroup._id);
							done();
						});
				});

				it('forbidden if not member or owner', function(done) {
					api
						.get(routeHelper('findOne', notMemberToken))
						.send({where: {_id: curGroup._id}})
						.expect(403, done);
				});
			});
		});
	});

	function checkIsInstanceNotChanged(istance, done, err, res) {
		if (err) return done(err);
		var Model = this;

		Model.findById(istance._id, function(err, result) {
			if (err) return done(err);

			assert.deepEqual(istance, modelToObj(result));
			done();
		});
	}

	function modelToObj(model) {
		return JSON.parse(JSON.stringify(model));
	}
});