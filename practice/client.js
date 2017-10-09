var PORT = 33333;

var HOST = '127.0.0.1';
//var HOST = 'attu3.cs.washington.edu'

var dgram = require('dgram');
var message = new Buffer([0xC4,0x61]);

var client = dgram.createSocket('udp4');

var message = Buffer.allocUnsafe(12);

message.writeUInt16BE(50273, 0);
message.writeUInt8(1, 2);
message.writeUInt8(0, 3);
message.writeUInt32BE(0, 4);
message.writeUInt32BE(666, 8);

client.send(message, 0, message.length, PORT,
  HOST, function (err, bytes) { client.close(); });
