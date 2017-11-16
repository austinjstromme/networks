// HTTP proxy code

var net = require('net');
var connection = require('./connection');

PORT = process.argv[2];


var proxy = net.createServer(function(socket) {
  var clientConn = new connection.clientConnection(proxy, socket);

  socket.on('error', (data) => {
    console.log(data);
  });
});

proxy.listen(PORT);
console.log('proxy listening on ' + PORT);

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
