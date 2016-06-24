var querystring = require('querystring');

module.exports = function(Model) {
	return function(routeName, params, token, filterObj) {
		routeName = routeName || null;
		params = params || {};
		token = token || '';
		filterObj = filterObj || {};

		if (typeof routeName !== 'string') {
			throw new Error('Missing "routeName" parameter.')
		}
		if (typeof token === 'object') {
			filterObj = token;
			token = '';
		}
		if (typeof params === 'string') {
			token = params;
			params = {};
		}

		var prefix = Model.app.settings.restApiRoot + Model.sharedClass.http.path;
		var method = Model.sharedClass._methods.filter(function(m) {
			// console.log(m.name, m.http.path);
			return m.name === routeName;
		})[0];
		method = method || {isStatic: true, http: {path: routeName}};

		var path = prefix;
		path += !method.isStatic ? '/:id' : '';
		path += method.http.path;

		path = path.replace(/(:(\w+)?(\(.+?\))?(\?)?)/g, function(m, pFull, pName) {
			if (!params.hasOwnProperty(pName) || !params[pName]) {
				throw new Error('Missing value for "' + pName + '".');
			}

			return params[pName];
		});

		path += '?' + querystring.stringify({
			access_token: token ? token : '',
			filter: filterObj ? JSON.stringify(filterObj) : ''
		});

		return path;
	};
};