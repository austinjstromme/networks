// HTTP proxy code

var net = require('net');
var connection = require('./connection');

PORT = process.argv[2];


var proxy = net.createServer(function(socket) {
  console.log('client connected to proxy!');
  var conn = new connection.connection(proxy, socket);
});

proxy.listen(PORT);
console.log('proxy listening on ' + PORT);
