var PORT = 33333;

//var HOST = '127.0.0.1';
var HOST = 'attu4.cs.washington.edu'

var dgram = require('dgram');
var message = new Buffer([0xC4,0x61]);

var client = dgram.createSocket('udp4');
client.send(message, 0, message.length, PORT, HOST, function(err, bytes) {
    if (err) throw err;
    console.log('UDP message sent to ' + HOST +':'+ PORT);
    client.close();
});
