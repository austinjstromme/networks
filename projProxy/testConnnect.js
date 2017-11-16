var net = require('net');

var ADDRESS = 'attu3.cs.washington.edu';
var PORT = 3333;


var socket = net.createConnection(PORT, ADDRESS);

socket.write('CONNECT www.google.com\r\nHost: google.com\r\n\r\n');

socket.on('data', (buf) => {
  console.log("recd >>>" + buf);
});
