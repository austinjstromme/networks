var net = require('net');
var cells = require('./cells');

const TIMEOUT = 3000; // timeout in ms
const MAX_TRIES = 3; // max tries
const LOGGING = true;

// An object containing a TCP connection between two routers. Handles incoming
//	  and outgoing cells on this connection.
exports.TCPRouterConnection = function (router, socket, destRouterID) {
  // This object needs to handle the OPEN-OPENED handshake
  // both when we initiate and when the other router does
  this.router = router;
  this.socket = socket;
  this.destRouterID = destRouterID;
  this.forward = true; // forward in the directed Tor61 network by default
  // STATE:
  //  0: haven't sent or received anything
  //  1: sent an open, waiting for an opened
  //  2: we're waiting for a created
  //  3: we've sent an opened or received an opened, not waiting for anything
  //  4: open has failed
  this.state = 0;

  this.tryOpen = (tries) => {
    if (tries < MAX_TRIES) {
      if (this.state == 0 || this.state == 1) {
        socket.write(cells.createOpenCell(router.id, this.destRouterID));
        this.logger("SENT OPEN");
        this.state = 1;
        setTimeout(this.tryOpen, TIMEOUT, tries + 1);
      }
    } else {
      this.state = 4;
      router.emit('openFailed');
    }
  }

  this.logger = (data) => {
    if (LOGGING) {
      console.log("TCPRouterConn (" + this.router.id + ", "
      + this.destRouterID + "): " + data);
    }
  }

  // send create message
  this.sendCreate = (circuitID) => {
    if (this.state == 3) {
      this.socket.write(cells.createCreateCell(circuitID));
      this.logger("SENT CREATE");
    } else {
      this.logger("DIDN'T SEND CREATE, TCPROUTERCONNECTION NOT UP YET");
    }
  }

  socket.on("data", (data) => {
    // parse data using cells, need to do some buffering
    if (data.length != 512) {
      this.logger("data on the socket is " + data.length + "bytes long")
    }
    var contents = cells.parseCell(data);

    if (!contents["valid"]) {
      this.logger("CORRUPT CELL");
      return;
    }

    if (contents["cmd"] == 1) {
      // CREATE
      this.logger("CREATE");
      this.router.emit('create', contents, this);
      this.socket.write(cells.createCreatedCell(contents["circuitID"]));
    } else if (contents["cmd"] == 2) {
      // CREATED
      this.logger("CREATED");
      this.router.emit('created', contents, this);
    } else if (contents["cmd"] == 3) {
      // CREATE FAILED
      this.logger("CREATE FAILED");
      var circ = this.router.outCircuitIDToCircuit(contents["circuitID"]);
      this.router.emit('createFailed', circ);
    } else if (contents["cmd"] == 4) {
      // DESTROY
      this.logger("DESTROY");
    } else if (contents["cmd"] == 5) {
      // OPEN
      this.logger("OPEN");
      this.destRouterID = contents["openerID"];
      this.router.emit('open', contents, this);
      this.socket.write(cells.createOpenedCell(this.router.id,
        this.destRouterID));
      this.logger("SENT OPENED");
      // successfully established a connection
      if (this.state == 0 || this.state == 3) {
        this.state = 3;
      }
    } else if (contents["cmd"] == 6) {
      // OPENED
      this.logger("OPENED");
      if (this.state == 1) {
        // waiting for this
        this.state = 3;
      }
    } else if (contents["cmd"] == 7) {
      // OPEN FAILED
      this.logger("OPEN FAILED");
      
    } else if (contents["cmd"] == 8) {
      // RELAY
      this.logger("RELAY");
    }
  });

  // only try open if we are the ones opening
  if (this.destRouterID != null) {
    this.logger("trying open");
    this.tryOpen(0);
  }
}

// object which holds TCP server connection which receives initiations from
//    other routers. 
exports.routerListener = function (router, port) {
  var listener = new net.createServer((socket) => {
    router.logger("received connection from another router!");
    var conn = new exports.TCPRouterConnection(router, socket, null);
    conn.forward = false; //this connection is backward in the network
  });

  listener.listen(port);
}
