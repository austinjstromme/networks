// HTTP proxy code

var net = require('net');
var connection = require('./connection');

PORT = process.argv[2];


var proxy = net.createServer(function(socket) {
  var clientConn = new connection.clientConnection(proxy, socket);
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
    console.log("error error errroorrrrr = " + data);
    if (!clientConn.socket.destroyed) {
      clientConn.socket.write("HTTP/1.0 502 Bad Gateway\r\n\r\n");
    }
  });

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
    console.log("timed out");
    if (clientConn.pHeader["type"] == "CONNECT") {
      clientConn.socket.write("HTTP/1.0 502 Bad Gateway\r\n\r\n");
    }
    clientConn.socket.close();
    serverConn.socket.close();
  });

  // if it's non-connect, send on the header and any body that's arrived
  if (clientConn.pHeader["type"] != "CONNECT") {
    console.log("it's not connect!");
    serverSocket.write((clientConn.pHeader["fullHeader"] + clientConn.sendBuf), serverSocket.encoding);
    clientConn.sendBuf = null;
  }
});

proxy.on('clientBody', (clientConn, body) => {
  if (body.length == 0) {
    return;
  }

  if (!clientConn.serverConn.socket.destroyed) {
    // forward it on with correct encoding
    clientConn.serverConn.socket.write(body, clientConn.encoding);
  }
});

proxy.on('serverHeader', (serverConn) => {
  // received a header from the server; forward it along to the client
  if (!serverConn.clientConn.socket.destroyed) {
    serverConn.clientConn.socket.write(serverConn.pHeader["fullHeader"]);
  }
});

proxy.on('serverBody', (serverConn, body) => {
  // received some body from the server; forward it along to the client
  if (!serverConn.clientConn.socket.destroyed) {
    serverConn.clientConn.socket.write(body, serverConn.encoding);
  }
});
