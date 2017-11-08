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

  var serverSocket = net.createSocket(clientConn.pHeader["port"], clientConn.pHeader["host"]);

  serverSocket.write(clientConn.pHeader["fullHeader"]);

  var serverConn = new connection.serverConnection(proxy, serverSocket, clientConn);

  clientConn.serverConn = serverConn;
});

proxy.on('clientBody', (clientConn, body) => {
  if (body.length == 0) {
    return;
  }

  if (clientConn.serverConn == null) {
    // fatal error
    console.log("FATAL ERROR - attempted ");
    process.exit(0);
  }

  clientConn.serverConn.socket.write(body);
});

proxy.on('serverHeader', (serverConn) => {

});
