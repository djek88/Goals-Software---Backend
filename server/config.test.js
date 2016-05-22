module.exports = {
	"restApiRoot": "/testApi",
	"host": "localhost",
	"port": 3444,
	"legacyExplorer": false,
	"remoting": {
		"context": {
			"enableHttpContext": false
		},
		"rest": {
			"normalizeHttpPath": false,
			"xml": false
		},
		"json": {
			"strict": false,
			"limit": "100kb"
		},
		"urlencoded": {
			"extended": true,
			"limit": "100kb"
		},
		"cors": false,
		"errorHandler": {
			"disableStackTrace": false
		}
	}
};