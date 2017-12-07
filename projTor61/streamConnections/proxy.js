// HTTP proxy code

var net = require('net');
var connection = require('./connection');
var stream = require('../stream');

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
    router.logger(">>> " + tokens[0] + " " + tokens[1]);

    // try and open up
    var addr = (clientConn.pHeader["host"] + ":" + clientConn.pHeader["port"] + "\0");
    clientConn.inStream.open(addr, 0);
  });

  proxy.on('clientBody', (clientConn, body) => {
    if (body.length == 0) {
      return;
    }
  
    if (clientConn.inStream.alive) {
      body = body.toString('ascii');
      console.log("writing onto tor network " + body.length + " bytes");
      // forward it on with correct encoding
      clientConn.inStream.send(body.toString('ascii'));
    } else {
      router.logger("proxy trying to send over a non-alive connection");
    }
  });

  proxy.on('openFailed', (stream) => {
      // send back bad gateway
      stream.clientConn.socket.write("HTTP/1.0 502 Bad Gateway\r\n\r\n");
  });
  
  /*proxy.on('serverHeader', (serverConn) => {
    // received a header from the server; forward it along to the client
    if (!serverConn.clientConn.socket.destroyed) {
      console.log(">>> " + serverConn.pHeader["fullHeader"].split(/\r\n+/)[0]);
      //console.log("writing in response = " + serverConn.pHeader["fullHeader"]);
      serverConn.clientConn.socket.write(serverConn.pHeader["fullHeader"], 'utf8');
    }
  });*/

  proxy.on('serverBody', (stream, body) => {
    // received some body from the server; forward it along to the client
    if (!stream.clientConn.socket.closed) {
      console.log("writing to client " + body.length + " bytes");
      serverConn.clientConn.socket.write(body, serverConn.dataEncoding);
    } else {
      console.log("stream.clientConn.socket closed, no body sent");
    }
  });

  return proxy;
}

exports.makeOutProxy = function (router, port) {
  console.log("port = " + port);

  var proxy = new net.createServer(function(socket) {
    var clientConn = new connection.clientConnection(proxy, socket);
  
    socket.on('error', (data) => {
      console.log(data);
    });
  });
  
  proxy.listen(port);
  router.logger('outProxy listening on ' + port);
  
  proxy.on('clientHeader', (clientConn) => {
    tokens = clientConn.pHeader["fullHeader"].split(/\s+/);
    console.log(">>> " + tokens[0] + " " + tokens[1]);
  
    var serverSocket = net.createConnection(clientConn.pHeader["port"],
      clientConn.pHeader["host"]);
  
    // handle problems with connecting:
    serverSocket.on('error', (data) => {
      console.log("clientConn.header = " + clientConn.pHeader["fullHeader"] + " had error in server socket");
      console.log(data);
      if (!clientConn.socket.destroyed) {
        clientConn.socket.write("HTTP/1.0 502 Bad Gateway\r\n\r\n");
      }
    });
  
    var serverConn = new connection.serverConnection(proxy, serverSocket, clientConn);
  
    clientConn.serverConn = serverConn;
  
    serverSocket.on('connect', () => {
      if (clientConn.pHeader["type"] == "CONNECT") {
        clientConn.socket.write("HTTP/1.0 200 OK\r\n\r\n", 'utf8');
        // clear off sendBuf
        clientConn.sendBuf = null;
      }
    });
  
    serverSocket.on('timeout', () => {
      console.log("timed out");
      if (clientConn.pHeader["type"] == "CONNECT") {
        clientConn.socket.write("HTTP/1.0 502 Bad Gateway\r\n\r\n");
      }
      clientConn.socket.close();
      serverConn.socket.close();
    });
  
    // if it's non-connect, send on the header and any body that's arrived
    if (clientConn.pHeader["type"] != "CONNECT") {
      //console.log("just wrote to server " + clientConn.pHeader["fullHeader"]);
      serverSocket.write(clientConn.pHeader["fullHeader"], 'utf8');
      if (clientConn.sendBuf != null) {
        // write anything remaining
        serverSocket.write(clientConn.sendBuf, clientConn.dataEncoding);
      }
      clientConn.sendBuf = null;
    }
  });
  
  proxy.on('clientBody', (clientConn, body) => {
    if (body.length == 0) {
      return;
    }
  
    if (!clientConn.serverConn.socket.destroyed) {
      //console.log("writing to server " + body.length + " bytes");
      // forward it on with correct encoding
      clientConn.serverConn.socket.write(body, clientConn.dataEncoding);
    }
  });
  
  proxy.on('serverHeader', (serverConn) => {
    // received a header from the server; forward it along to the client
    if (!serverConn.clientConn.socket.destroyed) {
      console.log(">>> " + serverConn.pHeader["fullHeader"].split(/\r\n+/)[0]);
      //console.log("writing in response = " + serverConn.pHeader["fullHeader"]);
      serverConn.clientConn.socket.write(serverConn.pHeader["fullHeader"], 'utf8');
    }
  });
  
  proxy.on('serverBody', (serverConn, body) => {
    // received some body from the server; forward it along to the client
    if (!serverConn.clientConn.socket.destroyed) {
      //console.log("wriiting to client " + body.length + " bytes");
      serverConn.clientConn.socket.write(body, serverConn.dataEncoding);
    } else {
      console.log("client was closed, no body sent");
    }
  });

  return proxy;
}
