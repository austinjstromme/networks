var net = require('net');
var cells = require('./cells');

// object which holds TCP server connection which receives initiations from
//    other routers. 
exports.routerListener = function(router, port) {
	var listener = net.createServer((socket) => {
		var conn = new TCPRouterConnection(router, socket);
	});
}

// An object containing a TCP connection between two routers. Handles incoming
//	  and outgoing cells on this connection.
exports.TCPRouterConnection = (router, socket) => {
  // This object needs to handle the OPEN-OPENED handshake
  // both when we initiate and when the other router does
}
