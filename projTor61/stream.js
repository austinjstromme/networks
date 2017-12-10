var net = require('net');
var streamConnections = require('./streamConnections/connection');
var cells = require('./cells');
var util = require('util');
var events = require('events');

const TIMEOUT = 3000;
const MAX_TRIES = 4;
const LOGGING = true;

exports.makeInStream = function (router, proxy, streamID) {
  var stream = new inStream(router, proxy, streamID);

  // save it in the routing tables
  router.inStreamIDToInStream.set(streamID, stream);

  // emitted when the router receives a connected from its own circuit with
  // this streamID
  stream.on('opened', () => {
    stream.logger("we're up and alive!");
    stream.alive = true;

    stream.proxy.emit('opened', stream);
  });

  stream.on('openFailed', () => {
    stream.logger("open failed!");

    stream.proxy.emit('openFailed', stream);
  });

  stream.on('response', (data) => {
    stream.logger("received response from the server on inStream");

    // convert to a buffer, then pass to serverConn as if it's real
    // (this is a hack to reuse the processing code in serverConn)
    data = Buffer.from(data, 'binary');
    stream.serverConn.socket.emit('data', data);
  });

  return stream;
}

// object encapsulating the browser-router interface
function inStream(router, proxy, streamID) {
  // A stream object will contain
  //  router: reference to the router
  //  proxy: reference to InProxy
  //  clientConn: reference to clientConnection
  //    (see streamConnections/connection.js)
  //  serverConn: just used for buffering and augmenting headers
  //  streamID: this stream's input
  //  alive: true if this is a good stream, false otherwise

  this.router = router;
  this.proxy = proxy;
  this.streamID = streamID;
  this.clientConn = null;
  this.serverConn = null;
  this.alive = false;

  this.logger = function (data) {
    if (LOGGING) {
      console.log("Tor61Router-" + router.id + "-inStream-" + this.streamID
        + ": " + data);
    }
  }

  // reliable open for this stream
  this.open = (addr, tries) => {
    if (this.alive) {
      // we're open! so done
      return;
    } else {
      if (tries < MAX_TRIES) {
        this.logger("trying to open to " + addr);
        // send off a begin stream cell
        this.router.emit('send', cells.createRelayCell(router.circuitID,
                                                       this.streamID,
                                                       0x01,
                                                       addr));
        // check back in TIMEOUT
        setTimeout(this.open, TIMEOUT, addr, tries + 1);
      } else {
        this.logger("ran out of tries trying to open");
        return;
      }
    }
  }

  // non-reliable send for this stream; requires this.alive
  this.send = function (data) {
    if (this.alive) {
      // TODO: this should be a bit less than 512 to account for the header
      for (var i = 0; i < (data.length/450); i++) {
        var chunk = data.substr(i*450, 450);
        this.logger("sending " + chunk.length + " bytes over our circuit");
        var cell = cells.createRelayCell(router.circuitID, this.streamID,
          2, chunk);

        this.router.emit('send', cell);
      }
    } else {
      this.logger("mayday mayday stream isn't alive but is being sent over!");
    }
  }
}


// object encapsulating the router-server interface
exports.outStream = function (router, streamID, circ, addr) {
  // A stream object will contain
  //  router: reference to the router
  //  streamID
  //  circ: circuit this is on
  //  serverSocket: socket to the server
  //  alive: true if this is a good stream, false otherwise

  this.router = router;
  this.streamID = streamID;
  this.circ = circ;
  this.alive = false;

  var tokens = addr.split('\0')[0].split(':');
  var IP = tokens[0];

  for (var i = 1; i < tokens.length - 1; i++) {
      IP += (":" + tokens[i]);
  }
  var port = tokens[tokens.length - 1];

  // non-reliable send for this stream; requires this.alive
  this.send = function (data) {
    if (this.alive) {
      for (var i = 0; i < (data.length/450); i++) {
        var chunk = data.substr(i*450, 450);
        //this.logger("sending " + chunk.length + " bytes backwards over the tor network");
        var cell = cells.createRelayCell(this.circ.inCircuitID, this.streamID,
          2, chunk);
        // write it off
        circ.inConn.socket.write(cell, 'binary');
      }
    } else {
      this.logger("mayday mayday stream isn't alive but is being sent over!");
    }
  }

  this.logger = function (data) {
    if (LOGGING) {
      console.log("Tor61Router-" + router.id + "-outStream-" + this.streamID
        + ": " + data);
    }
  }

  this.logger("opening a socket to " + IP + ":" + port);
  var serverSocket = net.createConnection(port, IP);

  serverSocket.on('connect', () => {
    this.logger("we're up and alive!");
    this.alive = true;

    // we're up - tell the router so
    this.router.emit('connected', this);
  });

  serverSocket.on('timeout', () => {
    this.router.emit('connectFailed', this);
  });

  serverSocket.on('error', (data) => {
    this.router.emit('connectFailed', this);
  });

  serverSocket.on('data', (buf) => {
    this.logger("received " + buf.length + " of data");
    this.send(buf.toString('binary'));
  });

  this.serverSocket = serverSocket;
}

util.inherits(inStream, events.EventEmitter);
