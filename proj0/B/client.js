// non-hread based implementation of a P0P client

// host and port give the location of the server
var HOST = process.argv[2];
var PORT = process.argv[3];

// import dgram which offers support for UDP on node
var dgram = require('dgram');

// make our server
var client = dgram.createSocket('udp6');

// set response types
const HELLO = 0;
const DATA = 1;
const ALIVE = 2;
const GOODBYE = 3;

client.on('listening', function () {
  var address = client.address();
  console.log('Listening on ' + address.address + ':'
    + address.port);
});

//client.on('message', function () {
//})

process.stdin.on('readable', function (data) {
  console.log(data);
});

// Helper functions

// sends messages of type HELLO, AlIVE, or GOODBYE
function respond(session, type) {
  var client = dgram.createSocket('udp6');

  console.log("we're sending off a " + type);

  var message = Buffer.allocUnsafe(12); // send 12 bytes of data for a header

  message.writeUInt16BE(50273, 0); // magic
  message.writeUInt8(1, 2); // version
  message.writeUInt8(type, 3); // message type
  message.writeUInt32BE(session["seqNum"], 4); // 
  message.writeUInt32BE(session["sesID"], 8);

  client.send(message, 0, message.length, session["clientPort"],
    session["clientAddress"], function (err, bytes) { client.close(); });
}