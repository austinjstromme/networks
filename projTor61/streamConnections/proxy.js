// HTTP proxy code

var net = require('net');
var connection = require('./connection');
var stream = require('../stream');
var cells = require('../cells');

exports.makeInProxy = function (router, port) {
  var proxy = new net.createServer(function(socket) {
    router.logger("connection on inProxy");
    // make an inStream object for this one, assign a streamID
    var streamID = router.streamCount++;

    var inStream = stream.makeInStream(router, proxy, streamID);
    var conn = new connection.clientConnection(proxy, inStream, socket);
    inStream.clientConn = conn;
  
    socket.on('error', (data) => {
      inStream.logger(data);
    });

  });

  proxy.listen(port);
  router.logger('inProxy listening on ' + port);

  // when the stream has been successfully opened it emits an open event
  proxy.on('opened', (stream) => {
    var clientConn = stream.clientConn;

    var socket = new net.Socket();
    var serverConn = new connection.serverConnection(proxy, socket, clientConn);
    stream.serverConn = serverConn;

    if (clientConn.pHeader["type"] != "CONNECT") {
      // send off the header
      stream.send(clientConn.pHeader["fullHeader"]);

      if (clientConn.sendBuf != null) {
        // write anything remaining
        stream.send(clientConn.sendBuf.toString(clientConn.dataEncoding));
      }
      clientConn.sendBuf = null;
    } else {
      console.log("connect request from browser succeeded!");
      // no need to send off the header in this case
      // successfully connected, send back ok
      stream.clientConn.socket.write("HTTP/1.0 200 OK\r\n\r\n", 'utf8');
      stream.clientConn.sendBuf = null;
    }
  });

  proxy.on('clientHeader', (clientConn) => {
    tokens = clientConn.pHeader["fullHeader"].split(/\s+/);
    clientConn.inStream.logger(">>> " + tokens[0] + " " + tokens[1]);

    // try and open up
    var addr = (clientConn.pHeader["host"] + ":" + clientConn.pHeader["port"] + "\0");
    clientConn.inStream.open(addr, 0);
  });

  proxy.on('clientBody', (clientConn, body) => {
    if (body.length == 0) {
      return;
    }

    if (clientConn.inStream.alive) {
      //console.log('writing onto tor network ' + body.length + ' bytes');
      // forward it on with correct encoding
      clientConn.inStream.send(body);
    } else {
      router.logger("proxy trying to send over a non-alive connection");
    }
  });

  proxy.on('openFailed', (stream) => {
      // send back bad gateway
      router.logger("sending back bad gateway");
      stream.clientConn.socket.write("HTTP/1.0 502 Bad Gateway\r\n\r\n");
  });
  
  proxy.on('serverHeader', (serverConn) => {
    // received a header from the server; forward it along to the client
    if (!serverConn.clientConn.socket.destroyed) {
      console.log(">>> " + serverConn.pHeader["fullHeader"].split(/\r\n+/)[0]);
      //console.log("writing in response = " + serverConn.pHeader["fullHeader"]);
      serverConn.clientConn.socket.write(serverConn.pHeader["fullHeader"], 'utf8');
    }
  });

  proxy.on('serverBody', (stream, body) => {
    // received some body from the server; forward it along to the client
    if (!stream.clientConn.socket.closed) {
      //console.log("writing to client " + body.length + " bytes");
      stream.clientConn.socket.write(body, 'binary');
    } else {
      console.log("stream.clientConn.socket closed, no body sent");
    }
  });

  return proxy;
}

/*exports.makeOutProxy = function (router, port) {
  var proxy = new net.createServer(function(socket) {
    var clientConn = new connection.clientConnection(proxy, socket);
  
    socket.on('error', (data) => {
      console.log(data);
    });
  });
  
  proxy.listen(port);
  router.logger('outProxy listening on ' + port);
  
  proxy.on('connect', (outStream) => {
    console.log("outProxy attempting to connect to: " + outStream.addr);
    var tokens = outStream.addr.split('\0')[0].split(':');
    var IP = tokens[0];

    for (var i = 1; i < tokens.length - 1; i++) {
      IP += (":" + tokens[i]);
    }
    var port = tokens[tokens.length - 1];
  
    var serverSocket = net.createConnection(port, IP);
  
    // handle problems with connecting:
    serverSocket.on('error', (data) => {
      outStream.emit('connectFailed');
    });
  
    outStream.serverSocket = serverSocket; 
  
    serverSocket.on('connect', () => {
      outStream.emit('connected');
    });
  
    serverSocket.on('timeout', () => {
      outStream.emit('connectFailed');
    });
  
  });
  
  proxy.on('clientBody', (stream, data) => {
    if (data.length == 0) {
      return;
    }
  
    if (!stream.serverSocket.destroyed) {
      stream.logger("writing to server " + data.length + " bytes");
      // forward it on with correct encoding
      stream.serverSocket.write(data, 'ascii');
    }
  });
  
  
  proxy.on('serverBody', (outStream, body) => {
    if (outStream.alive) {
      outStream.emit('inData', body.toString('ascii'));
    } else {
      outStream.logger("stream was closed, no body sent");
    }
  });

  return proxy;
}*/
