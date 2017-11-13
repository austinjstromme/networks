// HTTP proxy code

var net = require('net');
var connection = require('./connection');

PORT = process.argv[2];


var proxy = net.createServer(function(socket) {
  console.log('client connected to proxy!');
  var clientConn = new connection.clientConnection(proxy, socket);
});

proxy.listen(PORT);
console.log('proxy listening on ' + PORT);

proxy.on('clientHeader', (clientConn) => {
  tokens = clientConn.pHeader["fullHeader"].split(/\s+/);
  console.log(">>> " + tokens[0] + " " + tokens[1]);

  var serverSocket = net.createConnection(clientConn.pHeader["port"], clientConn.pHeader["host"]);

  var serverConn = new connection.serverConnection(proxy, serverSocket, clientConn);

  clientConn.serverConn = serverConn;

  serverSocket.on('connect', () => {
    if (clientConn.pHeader["type"] == "CONNECT") {
      console.log("server socket connected, and tunnel established");
      clientConn.socket.write("HTTP/1.0 200 OK\r\n\r\n", 'utf8');
      clientConn.encoding = 'binary';
      serverConn.encoding = 'binary';
      // clear off sendBuf
      clientConn.sendBuf = null;
    }
  });

  serverSocket.on('timeout', () => {
    if (clientConn.pHeader["type"] == "CONNECT") {
      clientConn.socket.write("HTTP/1.0 502 Bad Gateway\r\n\r\n");
    }
    clientConn.close();
    serverConn.close();
  });

  // if it's non-connect, send on the header and any body that's arrived
  if (clientConn.pHeader["type"] != "CONNECT") {
    serverSocket.write((clientConn.pHeader["fullHeader"] + clientConn.sendBuf), serverSocket.encoding);
    clientConn.sendBuf = null;
  }
});

proxy.on('clientBody', (clientConn, body) => {
  if (body.length == 0) {
    return;
  }

  // forward it on with correct encoding
  clientConn.serverConn.socket.write(body, clientConn.encoding);
});

proxy.on('serverHeader', (serverConn) => {
  // received a header from the server; forward it along to the client
  serverConn.clientConn.socket.write(serverConn.pHeader["fullHeader"]);
});

proxy.on('serverBody', (serverConn, body) => {
  // received some body from the server; forward it along to the client
  console.log("got some body from the server");
  serverConn.clientConn.socket.write(body);
});
