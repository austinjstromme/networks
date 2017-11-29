var net = require('net');
var cells = require('./cells');

const TIMEOUT = 3000; // timeout in ms
const MAX_TRIES = 3; // max tries

// object which holds TCP server connection which receives initiations from
//    other routers. 
exports.routerListener = function(router, port) {
	var listener = net.createServer((socket) => {
		var conn = new TCPRouterConnection(router, socket);
	});
}

// An object containing a TCP connection between two routers. Handles incoming
//	  and outgoing cells on this connection.
exports.TCPRouterConnection = (router, socket, destRouterID) => {
  // This object needs to handle the OPEN-OPENED handshake
  // both when we initiate and when the other router does
  this.router = router;
  this.socket = socket;
  this.destRouterID = destRouterID;
  this.waitingForCreated = false;

  // send create message
  function tryCreate(circuitID, tries) {
    if (tries == 0) {
      // haven't tried yet
      this.waitingForCreated = true;
      this.socket.write(cells.createCreateCell(circuitID));
      setTimeout(tryCreate, TIMEOUT, circuitID, tries + 1);
    } else if (!this.waitingForCreated) {
      // we've heard back, so we're done!
      return;
    } else if (tries < MAX_TRIES) {
      this.socket.write(cells.createCreateCell(circuitID));
      setTimeout(tryCreate, TIMEOUT, circuitID, tries + 1);
    } else {
      router.emit("createFailed", this);
    }
  }

  socket.on("data", (data) => {
    // parse data using cells, need to do some buffering

    if (message is CREATED && this.waitingForCreated) {
      this.waitingForCreated = false;
      router.emit("created", this);
    } else if (message is CREATEFAILED && this.waitingForCreated ) {
      router.emit("createFailed", this);
    }
  });

}
