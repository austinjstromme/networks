// non-hread based implementation of a P0P client

// 
var PORT = process.argv[2];

// import dgram which offers support for UDP on node
var dgram = require('dgram');

// make our server
var server = dgram.createSocket('udp6');

