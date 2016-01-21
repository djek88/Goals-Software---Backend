var async = require('async');

module.exports = function(Customer) {
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

	Customer.remoteMethod('uploadAvatar', {
		isStatic: false,
		description: 'Upload costomer img.',
		http: {path: '/upload-avatar', verb: 'post'},
		accepts: [
			{arg: 'req', type: 'object', 'http': {source: 'req'}},
			{arg: 'res', type: 'object', 'http': {source: 'res'}}
		],
		returns: {arg: 'customer', type: 'object'}
	});

	Customer.afterRemote('prototype.uploadAvatar', function(ctx, modelInstance, next) {
		var customer = ctx.instance;
		var fileName = ctx.result.customer.files.file[0].name;

		customer.avatar = '/Containers/' + customer._id + '/download/' + fileName;
		customer.save({ skipPropertyFilter: true }, function(err, result) {
			if (err) return next(err);

			ctx.result.customer = result;
			next();
		});
	});

	Customer.observe('before save', function removeAvatarField(ctx, next) {
		if (ctx.options && ctx.options.skipPropertyFilter) return next();

		if (ctx.isNewInstance) {
			ctx.instance.avatar = '/Containers/default-avatar/download/male.png';
			return next();
		}

		if (ctx.instance) {
			ctx.instance.unsetAttribute('avatar');
		} else {
			delete ctx.data.avatar;
		}

		next();
	});
};