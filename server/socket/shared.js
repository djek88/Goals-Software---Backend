module.exports = {
	checkAuthBeforeCall: checkAuthBeforeCall,
	onlineIdsInRoom: onlineIdsInRoom,
	onclose: onclose,
	onDisconnect: onDisconnect
};

function checkAuthBeforeCall(handler) {
	return function() {
		if (this.auth) handler.apply(this, arguments);
	};
}

function onlineIdsInRoom(nsp, roomName) {
	if (!nsp.adapter.rooms[roomName]) return [];

	var socketIds = nsp.adapter.rooms[roomName].sockets;
	var userIds = [];

	for(var id in socketIds) {
		userIds.push(nsp.connected[id].user._id.toString());
	}

	return userIds;
}

function onclose(reason) {
	var socket = this;

	if (socket.auth) {
		for (var room in socket.rooms) {
			socket.broadcast.to(room).emit('user:left', socket.user._id);
		}
	}

	Object.getPrototypeOf(socket).onclose.call(socket, reason);
}

function onDisconnect() {
	//console.log('user disconnected from goes nsp');
}