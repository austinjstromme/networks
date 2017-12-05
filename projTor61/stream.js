var net = require('net');
var streamConnections = require('./streamConnections/connection');
var cells = require('./cells');

const TIMEOUT = 3000;
const MAX_TRIES = 4;
const LOGGING = true;

exports.makeInStream = function (router, socket, streamID) {
  var stream = new inStream(router, socket, streamID);

  stream.on('clientHeader', (conn) => {
    // we've received a complete header, handle by:
    //  STEP 0: log that we got it 
    stream.logger("received header from client");
    //  STEP 1: have router make the stream
    var addr = (conn.pHeader["host"] + ":" + conn.pHeader["port"] + "\0");
    stream.open(addr, 0);

    stream.send(conn.headerBuf);
  });

  stream.on('opened', () => {
    stream.logger("we're up and alive!");
    stream.alive = true;
  }

  stream.on('clientBody', (conn, data) => {
    // we've received some body, handle by:
    //  STEP 0: log that we got it 
    stream.logger("received body from client");
    //  STEP 1: handle
    stream.send(data, 0);
  });

  stream.on('response', (data) => {
    // we've received some response from the server!
    stream.logger("received response from the server");
    // write the response back
    stream.socket.write(data);
  });
}

// object encapsulating the browser-router interface
exports.inStream = function (router, socket, streamID) {
  // A stream object will contain
  //  router: reference to the router
  //  socket: the socket this stream is listening
  //  streamID: this stream's input
  //  alive: true if this is a good stream, false otherwise
  //  clientConnection: stream connection object 

  this.router = router;
  this.socket = socket;
  this.streamID = streamID;
  this.alive = false;
  this.clientConnection = new streamConnections.clientConnection(this, socket);

  this.logger = function (data) {
    console.log("stream " + streamID + " at Tor61 router " + router.id
      + ": "+ data);
  }

  // reliable open for this stream
  this.open = function (addr, tries) {
    if (this.alive) {
      // we're open! so done
      return;
    } else {
      if (this.tries < MAX_TRIES) {
        this.logger("trying to open");
        // send off a open stream cell
        this.router.send(cells.createRelayCell(router.circuitID,
                                               this.streamID,
                                               1,
                                               addr));
        // check back in TIMEOUT
        setTimeout(this.open, TIMEOUT, addr, tries + 1);
      } else {
        this.logger("ran out of tires trying to open");
        return;
      }
    }
  }

  // non-reliable send for this stream
  this.send = function (data) {
    this.logger("sending data");
    for (var i = 0; i < (data.length/512 + 1); i++) {
      // chunk up the message and send it off
      this.router.emit('send', cells.CreateRelayCell(router.circuitID,
                                             this.streamID,
                                             2,
                                             data.substr(i*512, (i + 1)*512)));
    }
  }
}


// object encapsulating the router-socket interface
exports.outStream


