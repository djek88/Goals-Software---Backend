module.exports = function(Model) {
	return function(routeName, params, token) {
		if (typeof params === 'string') {
			token = params;
			params = {};
		} else if (!params) {
			params = {};
		}

		var prefix = Model.app.settings.restApiRoot + Model.sharedClass.http.path;
		var method = Model.sharedClass._methods.filter(function(m) {
			/*console.log(m.name, m.http.path);*/
			return m.name === routeName
		})[0];
		var path = prefix;

		if (!method) throw new Error('Route "' + routeName + '" not found.');

		if (!method.isStatic) {
			path += '/:id' + method.http.path;
		} else {
			path += method.http.path;
		}

		path = path.replace(/(:(\w+)?(\(.+?\))?(\?)?)/g, function(m, pFull, pName) {
			if (!params.hasOwnProperty(pName) || !params[pName]) {
				throw new Error('Missing value for "' + pName + '".');
			}

			return params[pName];
		});

		if (token) {
			path += '?access_token=' + token;
		}

		return path;
	};
};