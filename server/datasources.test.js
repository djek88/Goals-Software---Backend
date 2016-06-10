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
	"customerAvatarsStorage": {
		"name": "customerAvatarsStorage",
		"connector": "loopback-component-storage",
		"provider": "filesystem",
		"root": "./test/storage/customerAvatars"
	},
	"groupAvatarsStorage": {
		"name": "groupAvatarsStorage",
		"connector": "loopback-component-storage",
		"provider": "filesystem",
		"root": "./test/storage/groupAvatars"
	},
	"goalEvidencesStorage": {
		"name": "goalEvidencesStorage",
		"connector": "loopback-component-storage",
		"provider": "filesystem",
		"root": "./test/storage/goalEvidences"
	},
	"groupAttachmentStorage": {
		"name": "groupAttachmentStorage",
		"connector": "loopback-component-storage",
		"provider": "filesystem",
		"root": "./test/storage/groupAttachment"
	}
};