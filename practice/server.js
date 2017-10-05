var port = 33333;
var host = '127.0.0.1';

var dgram = require('dgram');
var server = dgram.createSocket('udp4');

server.on('listening', function () {
  var address = server.address();
  console.log('Listening on ' + address.address + ':'
    + address.port);
});

server.on('message', function (message, remote) {
  console.log(remote.address + ':' + remote.port + ' - ' + message);
});

server.bind(PORT, HOST);
