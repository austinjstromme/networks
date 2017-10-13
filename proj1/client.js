// Reggistration Client

// import dgram which offers support for UDP on node
var dgram = require('dgram');
var readline = require('readline');
var messages = require('./messages');

// HOST nd PORT of the registration service
REG_HOST = 'cse461.cs.washington.edu';
REG_PORT = 46101;

PORT = process.argv[2];

// make our sockets which will be bound to p and p+1
var client_sender = dgram.createSocket('udp4');
var client_listener = dgram.createSocket('udp4');

// listen for messages from registration service
client_sender.on('listening', function () {
};

// listen for messages from registration service
client_listener.on('listening', function () {
};

//create a read line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//check the input
rl.on('line', (input) => {
	
});

client_sender.bind(PORT);
client_listener.bind(PORT + 1);