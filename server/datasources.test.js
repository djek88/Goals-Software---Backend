module.exports = {
	"memory": {
		"name": "memory",
		"connector": "memory"
	},
	"transient": {
		"name": "transient",
		"connector": "transient"
	},
	"db": {
		"host": "localhost",
		"port": 27017,
		"database": "goalsSoftwareDBTest",
		"name": "db",
		"connector": "mongodb"
	},
	"avatarsStorage": {
		"name": "avatarsStorage",
		"connector": "loopback-component-storage",
		"provider": "filesystem",
		"root": "./test/storage/avatars"
	},
	"filesStorage": {
		"name": "filesStorage",
		"connector": "loopback-component-storage",
		"provider": "filesystem",
		"root": "./test/storage/files"
	}
};