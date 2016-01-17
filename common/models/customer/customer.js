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
		returns: {arg: 'link', type: 'string'}
	});

	Customer.afterRemote('prototype.uploadAvatar', function(ctx, responce, next) {
		var customer = ctx.instance;
		var fileName = ctx.result.link.files.file[0].name;
		var filePath = '/Containers/' + customer._id + '/download/' + fileName;

		responce.link = filePath;

		customer.avatar = filePath;
		customer.save(next);
	});
};