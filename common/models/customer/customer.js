var moment = require('moment-timezone');

module.exports = function(Customer) {
	Customer.validatesInclusionOf('timeZone', {in: moment.tz.names()});

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

	Customer.prototype.uploadAvatar = function(req, res, next) {
		var Container = Customer.app.models.Container;
		var customerId = this._id.toString();

		Container.getContainers(function (err, containers) {
			if (err) return next(err);

			if (containers.some(function(c) { return c.name === customerId; })) {
				return Container.upload(req, res, { container: customerId }, next);
			}

			Container.createContainer({ name: customerId }, function(err, c) {
				if (err) return next(err);
				Container.upload(req, res, { container: customerId }, next);
			});
		});
	};


	Customer.disableRemoteMethod('upsert', true);
	Customer.disableRemoteMethod('__get__accessTokens', false);
	Customer.disableRemoteMethod('__create__accessTokens', false);
	Customer.disableRemoteMethod('__delete__accessTokens', false);
	Customer.disableRemoteMethod('__findById__accessTokens', false);
	Customer.disableRemoteMethod('__updateById__accessTokens', false);
	Customer.disableRemoteMethod('__destroyById__accessTokens', false);
	Customer.disableRemoteMethod('__count__accessTokens', false);
	Customer.disableRemoteMethod('__create__Balance', false);
	Customer.disableRemoteMethod('__destroy__Balance', false);
	Customer.disableRemoteMethod('__create__Social', false);
	Customer.disableRemoteMethod('__destroy__Social', false);


	// Update avatar field in model
	Customer.afterRemote('prototype.uploadAvatar', setAvatarField);
	// Deny set manualy id field
	Customer.beforeRemote('create', delId);
	Customer.beforeRemote('prototype.updateAttributes', delId);
	// Restrict signup for now
	Customer.beforeRemote('create', checkInvitationKey);
	// Deny set manualy avatar field
	Customer.beforeRemote('create', delAvatar);
	Customer.beforeRemote('prototype.updateAttributes', delAvatar);

	function setAvatarField(ctx, modelInstance, next) {
		var customer = ctx.instance;
		var fileName = ctx.result.files.file[0].name;

		customer.avatar = '/Containers/' + customer._id + '/download/' + fileName;
		customer.save(function(err, result) {
			if (err) return next(err);

			ctx.result = result;
			next();
		});
	}

	function delId(ctx, customer, next) {
		delete ctx.req.body._id;
		next();
	}

	function checkInvitationKey(ctx, customer, next) {
		if (ctx.req.body.invitationKey !== 'mastermindSecretKey') {
			var error = new Error();
			error.statusCode = 401;
			error.message = 'Authorization Required';
			error.code = 'AUTHORIZATION_REQUIRED';
			return next(error);
		}

		delete ctx.req.body.invitationKey;
		next();
	}

	function delAvatar(ctx, customer, next) {
		delete ctx.req.body.avatar;
		next();
	}
};