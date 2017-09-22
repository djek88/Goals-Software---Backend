var fs = require('fs');
var _ = require('lodash');
var assert = require('chai').assert;
var async = require('async');
var server = require('../server/server');

var Customer = server.models.Customer;
var AccessToken = server.models.AccessToken;
var Group = server.models.Group;
var Goal = server.models.Goal;
var GoalEvidences = server.models.GoalEvidences;

var usersData = require('./resources/users');
var routeHelper = require('./lib/route-helper')(Goal);
var api;

describe('Goal model', function() {
	var groupOwner = new Customer(usersData.firstUser);
	var fMember = new Customer(usersData.secondUser);
	var sMember = new Customer(usersData.thirdUser);
	var notMember = new Customer(usersData.fourthUser);
	var group = new Group({
		name: 'firstTestGroup',
		_ownerId: groupOwner._id,
		_memberIds: [fMember._id, sMember._id],
		maxMembers: 3,
		sessionConf: {sheduled: false}
	});

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
			// save group in db
			function(cb) {
				group.save(function(err, result) {
					if (err) return cb(err);

					group = result;
					cb();
				});
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
		var curGoal;

		beforeEach(function(done) {
			curGoal = {
				name: 'testGoal',
				dueDate: Date.now() + 10*24*60*60*1000, // in 10 days
				_groupId: group._id
			};

			Goal.destroyAll(done);
		});

		describe('acls', function() {
			it('required authorization', function(done) {
				api
					.post(routeHelper('create'))
					.send(curGoal)
					.expect(401, goalNotExist.bind(null, curGoal, done));
			});
		});

		it('status 200', function(done) {
			api
				.post(routeHelper('create', ownerToken))
				.send(curGoal)
				.expect(200, function(err, res) {
					if (err) return done(err);

					Goal.findById(res.body._id, function(err, result) {
						if (err) return done(err);

						assert.deepEqual(res.body, modelToObj(result));
						done();
					});
				});
		});

		it('beforeRemote hook "delIdStateEvidencesFeedbacksVotes"', function(done) {
			var extraData = {
				_id: 'wrongId',
				state: 2,
				evidences: [1, 2],
				feedbacks: [3, 4],
				votes: [5, 6]
			};
			var newGoalData = _.assign({}, curGoal, extraData);

			api
				.post(routeHelper('create', ownerToken))
				.send(newGoalData)
				.expect(200, goalNotExist.bind(null, newGoalData, done));
		});

		it('beforeRemote hook "setOwnerId"', function(done) {
			var extraData = {_ownerId: 'wrongId'};
			var newGoalData = _.assign({}, curGoal, extraData);

			api
				.post(routeHelper('create', ownerToken))
				.send(newGoalData)
				.expect(200, function(err, res) {
					if (err) return done(err);

					Goal.findById(res.body._id, function(err, result) {
						if (err) return done(err);

						assert.notEqual(extraData._ownerId, result._ownerId);
						assert.equal(groupOwner._id, result._ownerId);
						done();
					});
				});
		});

		describe('beforeRemote hook "checkGroupId"', function() {
			var extraData = {_groupId: 'wrongId'};

			it('body must have _groupId', function(done) {
				api
					.post(routeHelper('create', ownerToken))
					.send({
						name: curGoal.name,
						dueDate: curGoal.dueDate
					})
					.expect(422, done);
			});

			it('body must have exist _groupId', function(done) {
				var newGoalData = _.assign({}, curGoal, extraData);

				api
					.post(routeHelper('create', ownerToken))
					.send(newGoalData)
					.expect(400, goalNotExist.bind(null, newGoalData, done));
			});

			it('must be a group member', function(done) {
				api
					.post(routeHelper('create', notMemberToken))
					.send(curGoal)
					.expect(403, goalNotExist.bind(null, curGoal, done));
			});
		});

		function goalNotExist(goal, done, err, res) {
			if (err) return done(err);

			Goal.find({where: goal}, function(err, results) {
				if (err) return done(err);

				assert.lengthOf(results, 0);
				done(null, res);
			});
		}
	});

	describe('find', function() {
		beforeEach(function(done) {
			Goal.destroyAll(done);
		});

		it('afterRemote hook "onlyOwnGoals"', function(done) {
			var ownerGoalsCount = 0;

			async.series([
				// create goals
				function(cb) {
					async.forEachOf(new Array(100), function(item, key, callback) {
						if (key % 2) ownerGoalsCount++;

						var newGoal = {
							name: 'name',
							dueDate: Date.now() + 10*24*60*60*1000, // in 10 days
							_ownerId: key % 2 ? groupOwner._id : fMember._id,
							_groupId: group._id
						};

						Goal.create(newGoal, callback);
					}, cb);
				},
				function(cb) {
					api
						.get(routeHelper('find', ownerToken))
						.expect(200, function(err, res) {
							if(err) return done(err);

							assert.equal(ownerGoalsCount, res.body.length);

							// all goals belong to the group owner
							for (var i = res.body.length - 1; i >= 0; i--) {
								assert.equal(res.body[i]._ownerId, groupOwner._id);
							}

							done();
						});
				}
			], done);
		});
	});

	describe('transactions with instance', function() {
		var curGoal;

		beforeEach(function(done) {
			curGoal = {
				name: 'name',
				description: 'desc',
				dueDate: Date.now() + 10*24*60*60*1000, // in 10 days
				state: 1,
				comments: 'comments',
				evidences: [],
				feedbacks: [],
				votes: [],
				_ownerId: groupOwner._id,
				_groupId: group._id
			};

			async.series([
				Goal.destroyAll.bind(Goal),
				// create goal
				function(cb) {
					Goal.create(curGoal, function(err, result) {
						if(err) return cb(err);

						curGoal = modelToObj(result);
						cb();
					});
				}
			], done);
		});

		describe('updateAttributes', function() {
			describe('acls', function() {
				it('required authorization', function(done) {
					api
						.put(routeHelper('updateAttributes', {id: curGoal._id}))
						.send({name: 'newName'})
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});

				it('deny if not owner', function(done) {
					api
						.put(routeHelper('updateAttributes', {id: curGoal._id}, fMemberToken))
						.send({name: 'newName'})
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});
			});

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

			it('beforeRemote hook "delIdStateEvidencesFeedbacksVotes"', function(done) {
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
		});

		describe('findById, findOne', function() {
			describe('findById afterRemote hook "checkIsOwnerOrGroupMember"', function(done) {
				it('status 200', function(done) {
					api
						.get(routeHelper('findById', {id: curGoal._id}, ownerToken))
						.expect(200, done);
				});

				it('status 403', function(done) {
					api
						.get(routeHelper('findById', {id: curGoal._id}, notMemberToken))
						.expect(403, done);
				});
			});

			describe('findOne afterRemote hook "checkIsOwnerOrGroupMember"', function(done) {
				it('status 200', function(done) {
					api
						.get(routeHelper('findOne', ownerToken))
						.send({where: {_id: curGoal._id}})
						.expect(200, done);
				});

				it('status 403', function(done) {
					api
						.get(routeHelper('findOne', notMemberToken))
						.send({where: {_id: curGoal._id}})
						.expect(403, done);
				});
			});
		});

		describe('leaveFeedback', function() {
			describe('acls', function() {
				it('required authorization', function(done) {
					api
						.post(routeHelper('leaveFeedback', {id: curGoal._id}))
						.send({feedback: 'feedback'})
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});
			});

			it('status 200', function(done) {
				var feedback = 'feedback';

				api
					.post(routeHelper('leaveFeedback', {id: curGoal._id}, fMemberToken))
					.send({feedback: feedback})
					.expect(200, function(err, res) {
						if (err) return done(err);

						Goal.findById(curGoal._id, function(err, result) {
							if (err) return done(err);

							assert.include(result.feedbacks, {_id: fMember._id, feedback: feedback});
							assert.deepEqual(res.body, modelToObj(result));
							done();
						});
					});
			});

			it('require feedback', function(done) {
				api
					.post(routeHelper('leaveFeedback', {id: curGoal._id}, fMemberToken))
					.expect(400, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
			});

			it('check is it group member', function(done) {
				api
					.post(routeHelper('leaveFeedback', {id: curGoal._id}, notMemberToken))
					.send({feedback: 'feedback'})
					.expect(403, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
			});
		});

		describe('notifyGroupMembers', function() {
			describe('acls', function() {
				it('required authorization', function(done) {
					api
						.get(routeHelper('notifyGroupMembers', {id: curGoal._id}))
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});

				it('deny if not owner', function(done) {
					api
						.get(routeHelper('notifyGroupMembers', {id: curGoal._id}, fMemberToken))
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});
			});

			it('status 200', function(done) {
				api
					.get(routeHelper('notifyGroupMembers', {id: curGoal._id}, ownerToken))
					.expect(204, function(err, res) {
						if (err) return done(err);

						Goal.findById(curGoal._id, function(err, result) {
							if (err) return done(err);

							assert.equal(result.state, 2);
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
						Goal.findById(curGoal._id, function(err, result) {
							if (err) return cb(err);

							api
								.get(routeHelper('notifyGroupMembers', {id: curGoal._id}, ownerToken))
								.expect(403, checkIsInstanceNotChanged.bind(Goal, modelToObj(result), done));
						});
					}
				], done);
			});

			// function isNotChangedState(done, err, res) {
			// 	if (err) return done(err);

			// 	Goal.findById(curGoal._id, function(err, result) {
			// 		if (err) return done(err);

			// 		assert.notEqual(result.state, 2);
			// 		done();
			// 	});
			// }
		});

		describe('uploadEvidence', function() {
			var fileName = 'testFile.png';
			var pathToFile = './test/resources/';
			var filesFolder = './test/storage/goalEvidences/';

			beforeEach(function(done) {
				GoalEvidences.getContainers(function(err, containers) {
					if (err) return done(err);

					containers = containers.filter(function(c) {return c.name !== 'default-folder'});

					async.each(containers, function(container, cb) {
						GoalEvidences.destroyContainer(container.name, cb);
					}, done);
				});
			});

			describe('acls', function() {
				it('required authorization', function(done) {
					api
						.post(routeHelper('uploadEvidence', {id: curGoal._id}))
						.attach('file', pathToFile + fileName)
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});

				it('deny if not owner', function(done) {
					api
						.post(routeHelper('uploadEvidence', {id: curGoal._id}, fMemberToken))
						.attach('file', pathToFile + fileName)
						.expect(401, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
				});
			});

			it('require file', function(done) {
				api
					.post(routeHelper('uploadEvidence', {id: curGoal._id}, ownerToken))
					.expect(400, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
			});

			it('success save file', function(done) {
				api
					.post(routeHelper('uploadEvidence', {id: curGoal._id}, ownerToken))
					.attach('file', pathToFile + fileName)
					.expect(200, function(err, res){
						if (err) return done(err);

						var files = fs.readdirSync(filesFolder + curGoal._id + '/');
						assert.equal(files.length, 1);
						var splitedName = files[0].split('.');
						assert.equal(splitedName[0] + '.' + splitedName[splitedName.length - 1], fileName);
						done();
					});
			});

			it('success change goal', function(done) {
				api
					.post(routeHelper('uploadEvidence', {id: curGoal._id}, ownerToken))
					.attach('file', pathToFile + fileName)
					.expect(200, function(err, res){
						if (err) return done(err);

						Goal.findById(curGoal._id, function(err, goal) {
							if (err) return done(err);

							assert.equal(goal.evidences.length, 1);
							assert.equal(goal.evidences[0].container, curGoal._id);
							assert.equal(goal.evidences[0].originalFilename, fileName);
							done();
						});
					});
			});

			it('correct responce', function(done) {
				api
					.post(routeHelper('uploadEvidence', {id: curGoal._id}, ownerToken))
					.attach('file', pathToFile + fileName)
					.expect(200, function(err, res){
						if (err) return done(err);

						Goal.findById(curGoal._id, function(err, goal) {
							if (err) return done(err);

							assert.deepEqual(modelToObj(goal), res.body);
							done();
						});
					});
			});
		});

		describe('removeEvidence', function() {
			var goalForCurSuite;
			var fileName;
			var pathToFile = './test/resources/testFile.png';
			var filesFolder = './test/storage/goalEvidences/';

			// upload file before each test
			beforeEach(function(done) {
				goalForCurSuite = _.assign({}, curGoal);

				api
					.post(routeHelper('uploadEvidence', {id: goalForCurSuite._id}, ownerToken))
					.attach('file', pathToFile)
					.expect(200, function(err, res) {
						if (err) return done(err);

						Goal.findById(goalForCurSuite._id, function(err, result) {
							if (err) return done(err);

							assert.deepProperty(result, 'evidences[0].name');
							fileName = res.body.evidences[0].name;
							goalForCurSuite = modelToObj(result);
							done();
						});
					});
			});

			it('success change goal', function(done) {
				api
					.post(routeHelper('removeEvidence', {id: goalForCurSuite._id}, ownerToken))
					.send({fileName: fileName})
					.expect(200, function(err, res){
						if (err) return done(err);

						Goal.findById(goalForCurSuite._id, function(err, result) {
							if (err) return done(err);

							assert.lengthOf(result.evidences, 0);
							done();
						});
					});
			});

			it('success remove file', function(done) {
				api
					.post(routeHelper('removeEvidence', {id: goalForCurSuite._id}, ownerToken))
					.send({fileName: fileName})
					.expect(200, function(err, res){
						if (err) return done(err);

						var files = fs.readdirSync(filesFolder + goalForCurSuite._id + '/');
						assert.equal(files.length, 0);
						done();
					});
			});

			it('require fileName', function(done) {
				api
					.post(routeHelper('removeEvidence', {id: goalForCurSuite._id}, ownerToken))
					.expect(400, checkIsInstanceNotChanged.bind(Goal, goalForCurSuite, done));
			});

			it('correct responce', function(done) {
				api
					.post(routeHelper('removeEvidence', {id: goalForCurSuite._id}, ownerToken))
					.send({fileName: fileName})
					.expect(200, function(err, res){
						if (err) return done(err);

						Goal.findById(goalForCurSuite._id, function(err, goal) {
							if (err) return done(err);

							assert.deepEqual(modelToObj(goal), res.body);
							done();
						});
					});
			});

			describe('acls', function() {
				it('required authorization', function(done) {
					api
						.post(routeHelper('removeEvidence', {id: curGoal._id}))
						.send({fileName: fileName})
						.expect(401, checkIsInstanceNotChanged.bind(Goal, goalForCurSuite, done));
				});

				it('deny if not owner', function(done) {
					api
						.post(routeHelper('removeEvidence', {id: curGoal._id}, fMemberToken))
						.send({fileName: fileName})
						.expect(401, checkIsInstanceNotChanged.bind(Goal, goalForCurSuite, done));
				});
			});
		});

		describe('leaveVote', function() {
			it('err if goal state not 2 or 4', function(done) {
				api
					.post(routeHelper('leaveVote', {id: curGoal._id}, fMemberToken))
					.send({achieve: true})
					.expect(403, checkIsInstanceNotChanged.bind(Goal, curGoal, done));
			});

			describe('leave vote success', function() {
				// cange goal state to 2
				beforeEach(function(done) {

					Goal.updateAll({
							_id: curGoal._id
						}, {
							state: 2
						},
						function(err, info) {
							done(err);
							assert.equal(1, info.count);
						});
				});

				it('create vote success', function(done) {
					var vote = {
						achieve: !!Math.round(Math.random()),
						comment: 'comment'
					};

					api
						.post(routeHelper('leaveVote', {id: curGoal._id}, fMemberToken))
						.send(vote)
						.expect(200, function(err, res) {
							if (err) return done(err);

							Goal.findById(curGoal._id, function(err, result) {
								if (err) return done(err);

								assert.lengthOf(result.votes, 1);
								assert.equal(result.votes[0].approved, vote.achieve);
								assert.equal(result.votes[0]._approverId, fMember._id);
								assert.equal(result.votes[0].comment, !vote.achieve ? vote.comment : '');
								done();
							});
						});
				});

				it('change vote if already exist success', function(done) {
					async.series([
						// prepare vote
						function(cb) {
							var oldVote = {
								approved: false,
								_approverId: fMember._id,
								comment: 'falseComment',
								createAt: new Date()
							};

							Goal.updateAll({
									_id: curGoal._id
								}, {
									votes: [oldVote]
								},
								function(err, info) {
									cb(err);
									assert.equal(1, info.count);
								});
						},
						function(cb) {
							var vote = {
								achieve: true,
								comment: ''
							};

							api
								.post(routeHelper('leaveVote', {id: curGoal._id}, fMemberToken))
								.send(vote)
								.expect(200, function(err, res) {
									if (err) return done(err);

									Goal.findById(curGoal._id, function(err, result) {
										if (err) return done(err);

										assert.lengthOf(result.votes, 1);
										assert.equal(result.votes[0].approved, vote.achieve);
										assert.equal(result.votes[0]._approverId, fMember._id);
										assert.equal(result.votes[0].comment, vote.comment);
										done();
									});
								});
						}
					], done);
				});

				it('change state success', function(done) {
					var vote = {
						achieve: false,
					};

					api
						.post(routeHelper('leaveVote', {id: curGoal._id}, fMemberToken))
						.send(vote)
						.expect(200, function(err, res) {
							if (err) return done(err);

							Goal.findById(curGoal._id, function(err, result) {
								if (err) return done(err);

								assert.equal(result.state, 4);
								vote.achieve = true;

								api
									.post(routeHelper('leaveVote', {id: curGoal._id}, fMemberToken))
									.send(vote)
									.expect(200, function(err, res) {
										if (err) return done(err);

										Goal.findById(curGoal._id, function(err, result) {
											if (err) return done(err);

											assert.equal(result.state, 2);
											done();
										});
									});
							});
						});
				});

				it('correct responce', function(done) {
					api
						.post(routeHelper('leaveVote', {id: curGoal._id}, fMemberToken))
						.send({achieve: true})
						.expect(200, function(err, res) {
							if (err) return done(err);

							Goal.findById(curGoal._id, function(err, goal) {
								if (err) return done(err);

								assert.deepEqual(modelToObj(goal), res.body);
								done();
							});
						});
				});

				describe('acls', function() {
					var goal;

					beforeEach(function() {
						goal = _.assign({}, curGoal, {state: 2});
					});

					it('required authorization', function(done) {
						api
							.post(routeHelper('leaveVote', {id: curGoal._id}))
							.send({achieve: true})
							.expect(401, checkIsInstanceNotChanged.bind(Goal, goal, done));
					});

					it('deny if not group member', function(done) {
						api
							.post(routeHelper('leaveVote', {id: curGoal._id}, notMemberToken))
							.send({achieve: true})
							.expect(403, checkIsInstanceNotChanged.bind(Goal, goal, done));
					});

					it('deny if owner owner', function(done) {
						api
							.post(routeHelper('leaveVote', {id: curGoal._id}, ownerToken))
							.send({achieve: true})
							.expect(403, checkIsInstanceNotChanged.bind(Goal, goal, done));
					});
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