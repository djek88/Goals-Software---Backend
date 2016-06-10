var http = require('http');
var async = require('async');
var moment = require('moment-timezone');
var ApiError = require('../../../server/lib/error/Api-error');

module.exports = function(Customer) {
	Customer.validatesInclusionOf('timeZone', {in: moment.tz.names()});

	// Disable unnecessary methods
	Customer.disableRemoteMethod('upsert', true);
	Customer.disableRemoteMethod('create', true);
	Customer.disableRemoteMethod('exists', true);
	Customer.disableRemoteMethod('createChangeStream', true);
	Customer.disableRemoteMethod('__get__accessTokens', false);
	Customer.disableRemoteMethod('__create__accessTokens', false);
	Customer.disableRemoteMethod('__delete__accessTokens', false);
	Customer.disableRemoteMethod('__findById__accessTokens', false);
	Customer.disableRemoteMethod('__updateById__accessTokens', false);
	Customer.disableRemoteMethod('__destroyById__accessTokens', false);
	Customer.disableRemoteMethod('__count__accessTokens', false);
	Customer.disableRemoteMethod('__create__Balance', false);
	Customer.disableRemoteMethod('__update__Balance', false);
	Customer.disableRemoteMethod('__get__Balance', false);
	Customer.disableRemoteMethod('__destroy__Balance', false);
	Customer.disableRemoteMethod('__create__Social', false);
	Customer.disableRemoteMethod('__update__Social', false);
	Customer.disableRemoteMethod('__get__Social', false);
	Customer.disableRemoteMethod('__destroy__Social', false);
	Customer.disableRemoteMethod('__create__GroupPreferences', false);
	Customer.disableRemoteMethod('__update__GroupPreferences', false);
	Customer.disableRemoteMethod('__get__GroupPreferences', false);
	Customer.disableRemoteMethod('__destroy__GroupPreferences', false);

	// UploadAvatar request
	Customer.remoteMethod('uploadAvatar', {
		isStatic: false,
		description: 'Upload costomer img.',
		http: {path: '/upload-avatar', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'res', type: 'object', 'http': {source: 'res'}}
		],
		returns: {type: 'object', root: true}
	});
	// Get base customer info
	Customer.remoteMethod('baseCustomerInfo', {
		isStatic: false,
		description: 'Get base customer info.',
		http: {path: '/base-info', verb: 'get'},
		returns: {type: 'object', root: true}
	});
	// Login method for developing//////////////////////////////////////////////////////////////////////////////
	Customer.remoteMethod('devLoginnnnnnnnnnnnnnnnnnnnnnnnn', {
		accepts: [
			{arg: 'credentials', type: 'object', required: true, http: {source: 'body'}},
		],
		returns: {arg: 'accessToken', type: 'object', root: true},
		http: {verb: 'post'}
	});

	Customer.prototype.uploadAvatar = function(req, res, next) {
		var Container = Customer.app.models.CustomerAvatars;
		var customer = this;

		// if don't have file
		if (!req._readableState.length) return next(ApiError.incorrectParam('file'));

		Container.getContainers(function (err, containers) {
			if (err) return next(err);

			if (containers.some(function(c) {return c.name === customer._id;})) {
				Container.destroyContainer(customer._id, createContainerSaveFile);
			} else {
				createContainerSaveFile(null);
			}
		});

		function createContainerSaveFile(err) {
			if (err) return next(err);

			Container.createContainer({ name: customer._id }, function(err, c) {
				if (err) return next(err);

				var options = {
					container: customer._id,
					allowedContentTypes: function(file) {
						// if file type incorect return array with non existent mime types
						if (!file.type.includes('image/')) return ['image/*'];
					}
					//maxFileSize: can pass a function(file, req, res) or number, default is 10 MB
					//acl: can pass a function(file, req, res)
				};

				Container.upload(req, res, options, setAvatarField);
			});
		}

		function setAvatarField(err, filesObj) {
			if (err) return next(err);

			var fileName = filesObj.files.file[0].name;

			customer.updateAttributes({
				avatar: '/CustomerAvatars/' + customer._id + '/download/' + fileName
			}, next);
		}
	};

	Customer.prototype.baseCustomerInfo = function(next) {
		var customer = this;
		var allowedInfo = {};

		Customer.settings.whiteListFields.forEach(function(property) {
			allowedInfo[property] = customer[property];
		});

		next(null, allowedInfo);
	};

	Customer.devLoginnnnnnnnnnnnnnnnnnnnnnnnn = function(credentials, next) {
		Customer.login(credentials, 'user', next);
	};

	// Login by FHQ sessionId
	Customer.beforeRemote('login', loginBySessionId);
	// Deny set manualy id, fhqSessionId, avatar, email, password fields
	Customer.beforeRemote('prototype.updateAttributes', delProperties);

	function loginBySessionId(ctx, customer, next) {
		var sessionId = ctx.req.body._sessionId;

		if (!sessionId) return next(ApiError.incorrectParam('_sessionId'));

		async.waterfall([
			getMemberData.bind(null, sessionId),
			function(response, cb) {
				Customer.findById(response.userid, function(err, customer) {
					cb(err, response, customer);
				});
			},
			function(response, customer, cb) {
				if (customer) {
					customer.updateAttributes({
						email: response.email,
						firstName: response.fname,
						lastName: response.lname,
						fhqSessionId: sessionId,
						password: sessionId
					}, cb);
				} else {
					Customer.create({
						_id: response.userid,
						email: response.email,
						firstName: response.fname,
						lastName: response.lname,
						fhqSessionId: sessionId,
						password: sessionId
					}, cb);
				}
			},
			function(customer, cb) {
				if (!customer) return cb(new ApiError(500, 'Internal server error'));

				ctx.args.credentials = {
					email: customer.email,
					password: sessionId
				};

				cb();
			}
		], next);

		function getMemberData(sessionId, cb) {
			var reqPath = 'http://www.fusionhq.com/index.php?act=api&todo=loginmemsiteauto&apiemail=leon@leonjay.info&apikey=e174d0a9&memsite=498797&sessionid=' + sessionId;

			http.get(reqPath, function(res) {
				var response = '';

				res.on('data', function(chunk) {
					response += chunk;
				});

				res.on('end', function() {
					response = JSON.parse(response);

					if (!response.success) return cb(new ApiError(401, response.message));

					cb(null, response);
				});
			}).on('error', cb);
		}
	}

	function delProperties(ctx, customer, next) {
		delete ctx.req.body._id;
		delete ctx.req.body._fhqSessionId;
		delete ctx.req.body.email;
		delete ctx.req.body.password;
		delete ctx.req.body.avatar;
		next();
	}
};
