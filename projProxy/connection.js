var events = require('events');

function completeHeader(string) {
  for (var i = 0; i < string.length - 3; i++) {
    substr  = string.substr(i, 4);
    if (substr == '\r\n\r\n') {
      return i;
    }
  }
  return -1;
}

function handleRequest(server, socket, message, bodyIndex) {
  // process message and augment

  //if (REQUEST) {
    // generate request
//    server.emit('request', args);
//  } else if (CONNECT) {
//    server.emit('connect', args);
//  }

  console.log("message = " + message);
}

exports.connection = function (server, socket) {
  this.server = server;
  this.socket = socket;
  this.message = "";
  this.receivedHeader = false;
  events.EventEmitter.call(this);

  socket.on('data', function(buf) {
    console.log("received data! buf = " + buf);
    if (!this.receivedHeader) {
      // append buffer
      this.message += buf;
      // check if it's a complete header:
      header = completeHeader(this.message);
      if (header != -1) {
        // it's a complete header - handle the request
        handleRequest(server, socket, this.message, header + 4);
      }
    }
  });
}
