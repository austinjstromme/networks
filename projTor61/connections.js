var net = require('net');
var cells = require('./cells');

const TIMEOUT = 3000; // timeout in ms
const MAX_TRIES = 3; // max tries

// object which holds TCP server connection which receives initiations from
//    other routers. 
exports.routerListener = function(router, port) {
  var listener = net.createServer((socket) => {
    var conn = new TCPRouterConnection(router, socket, null);
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
  // STATE:
  //  0: haven't sent or received anything
  //  1: sent an open, waiting for an opened
  //  2: we're waiting for a created
  //  3: we've sent an opened or received an opened, not waiting for anything
  //  4: open has failed
  this.state = 0;

  function tryOpen(tries) {
    if (tries < MAX_TRIES) {
      if (this.state == 0 || this.state == 1) {
        socket.write(cells.createOpenCell(router.id, this.destRouterID);
        this.state = 1;
        setTimeout(tryOpen, TIMEOUT, tries + 1);
      }
    } else {
      this.state = 4;
      router.emit('openFailed');
    }
  }

  // send create message
  function tryCreate(circuitID, tries) {
    if (this.state == 4) {
      // open has failed, ABORT
      return;
    }

    if (tries == 0) {
      if (this.state == 3) {
        // connection is ready to go, start creating
        this.socket.write(cells.createCreateCell(circuitID));
        setTimeout(tryCreate, TIMEOUT, circuitID, tries + 1);
      } else {
        // connection is not ready, still waiting for an opened
        setTimeout(tryCreate, TIMEOUT, circuitID, tries);
      }
    } else if (tries < MAX_TRIES) {
      if (this.state == 2) {
        // still waiting for a created, try again
        this.socket.write(cells.createCreateCell(circuitID));
        setTimeout(tryCreate, TIMEOUT, circuitID, tries + 1);
      } else {
        // we've heard back, so we're done!
        return;
      }
    } else {
      // hit max tries, and create has failed
      router.emit("createFailed", this);
      this.state = 3;
    }
  }

  socket.on("data", (data) => {
    // parse data using cells, need to do some buffering
    if (data.length != 512) {
      console.log("data on the socket is " + data.length + "bytes long")
    }
    var contents = cells.parseCell(data);

    if (!contents["valid"]) {
      console.log("corrupt cell from router " + this.destRouterID);
      return;
    }

    if (contents["cmd"] == 1) {
      // CREATE

    } else if (contents["cmd"] == 2) {
      // CREATED

    } else if (contents["cmd"] == 3) {
      // CREATE FAILED

    } else if (contents["cmd"] == 4) {
      // DESTROY

    } else if (contents["cmd"] == 5) {
      // OPEN
      this.router.emit('open', contents);
      this.socket.write(cells.createOpenedCell(this.router.id,
        this.destRouterID));
      // successfully established a connection
      if (this.state == 0 || this.state == 3) {
        this.state = 3;
      }
    } else if (contents["cmd"] == 6) {
      // OPENED
      if (this.state == 1) {
        // waiting for this
        this.state = 3;
      }
    } else if (contents["cmd"] == 7) {
      // OPEN FAILED
      
    } else if (contents["cmd"] == 8) {
      // RELAY

    }
  });

  // only try open if we are the ones opening
  if (this.destRouterID != null) {
    tryOpen(0);
  }
}
