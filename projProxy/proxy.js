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

  serverSocket.write(clientConn.pHeader["fullHeader"] + clientConn.sendBuf);
  //console.log("just wrote to serverSocket " + clientConn.pHeader["fullHeader"] + clientConn.sendBuf);
  clientConn.sendBuf = null;

  clientConn.serverConn = serverConn;
});

proxy.on('clientBody', (clientConn, body) => {
  if (body.length == 0) {
    return;
  }

  // forward it on
  clientConn.serverConn.socket.write(body);
});

proxy.on('serverHeader', (serverConn) => {
  // received a header from the server; forward it along to the client
  serverConn.clientConn.socket.write(serverConn.pHeader["fullHeader"]);
});

proxy.on('serverBody', (serverConn, body) => {
  // received some body from the server; forward it along to the client
  serverConn.clientConn.socket.write(body);
});
