//HTTP proxy code

var net = require('net');

PORT = process.argv[2];


var server = net.createServer(function(socket){


});

server.listen(PORT, '127.0.0.1');
console.log('proxy listening on port ' + PORT);