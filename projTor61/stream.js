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

    stream.proxy.emit('serverBody', stream, data);
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
  //  streamID: this stream's input
  //  alive: true if this is a good stream, false otherwise

  this.router = router;
  this.proxy = proxy;
  this.streamID = streamID;
  this.clientConn = null;
  this.alive = false;

  this.logger = function (data) {
    console.log("Tor61Router-" + router.id + "-Stream-" + this.streamID
      + ": " + data);
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
      this.logger("sending data");
      // TODO: this should be a bit less than 512 to account for the header
      for (var i = 0; i < (data.length/512); i++) {
        var chunk = data.substr(i*512, (i + 1)*512);
        this.logger("sending chunk of size = " + chunk.length);
        // chunk up the message and send it off
        this.router.emit('send', cells.createRelayCell(router.circuitID,
                                                       this.streamID,
                                                       2,
                                                       chunk));
      }
    } else {
      this.logger("mayday mayday stream isn't alive but is being sent over!");
    }
  }
}


exports.makeOutStream = function (router, proxy, streamID) {
  var stream = new outStream(router, proxy, streamID);

  stream.on('connected', () => {
    stream.logger("we're up and alive!");
    stream.alive = true;

    stream.router.emit('connected', stream);
  });

  stream.on('connectFailed', () => {
    stream.logger("connect to server failed!");

    stream.router.emit('beginFailed', stream);
  });

  stream.on('response', (data) => {
    stream.logger("received response from the server on outStream");

    stream.router.emit('serverBody', stream, data);
  });
}

// object encapsulating the router-server interface
exports.outStream = function (router, proxy, streamID) {
  // A stream object will contain
  //  router: reference to the router
  //  proxy: reference to InProxy
  //  clientConn: reference to clientConnection
  //    (see streamConnections/connection.js)
  //  streamID: this stream's input
  //  alive: true if this is a good stream, false otherwise

  this.router = router;
  this.proxy = proxy;
  this.streamID = streamID;
  this.clientConn = null;
  this.alive = false;

  this.logger = function (data) {
    console.log("stream " + streamID + " at Tor61 router " + router.id
      + ": "+ data);
  }

  this.open = function (addr, tries) {
    if (this.alive) {
      // we're open! so done
      return;
    } else {
      if (this.tries < MAX_TRIES) {
        this.logger("trying to open to " + addr);
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

  // non-reliable send for this stream; requires this.alive
  this.send = function (data) {
    if (this.alive) {
      this.logger("sending data");
      for (var i = 0; i < (data.length/512 + 1); i++) {
        // chunk up the message and send it off
        this.router.emit('send', cells.CreateRelayCell(router.circuitID,
                                                       this.streamID,
                                                       2,
                                                       data.substr(i*512, (i + 1)*512)));
      }
    } else {
      this.logger("mayday mayday stream isn't alive but is being sent over!");
    }
  }
}

util.inherits(inStream, events.EventEmitter);
