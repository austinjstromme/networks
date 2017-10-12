// non-hread based implementation of a P0P client

// host and port give the location of the server
var HOST = process.argv[2];
var PORT = process.argv[3];

// import dgram which offers support for UDP on node
var dgram = require('dgram');
var readline = require('readline');
var messages = require('../utils/messages');

// make our server
var client = dgram.createSocket('udp4');

// generate a random session ID
var sesID = Math.floor(Math.random() * (Math.pow(2, 32) - 1));

// sequence number to keep track of correspondence
var seqNum = 0;

// after 30 seconds of no activity send GOODBYE and close
var timeout = setTimeout(sendGoodbye, 3000000);
var nohello = true;
var clientClosed = false;

// listen for messages from server
client.on('listening', function () {
  var address = client.address();
  console.log('Listening on ' + address.address + ':'
    + address.port);

  // send HELLO
  messages.sendMessage(client, PORT, HOST, seqNum, sesID, 0x0);
  seqNum++;
});

// handle incoming messages
client.on('message', function (message, remote) {
  // process the message
  var pMessage = messages.processMessage(message);
  var command = pMessage["command"];

  if (command == 0x0) { // on receiving HELLO, go to listening state
    nohello = false;
  	clearTimeout(timeout);
  	timeout = setTimeout(sendGoodbye, 3000000);
  } else if (command == 0x2) { // on reveiving ALIVE, go to listening state
  	clearTimeout(timeout);
  	timeout = setTimeout(sendGoodbye, 3000000);
  } else if (command == 0x3) { // on reveiving GOODBYE, close the client
    client.close();
  }
});

client.on('close', function () {
  process.exit(0);
});

client.bind(33331);

//create a read line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// send std input to the server
rl.on('line', (input) => {
    messages.sendMessage(client, PORT, HOST, seqNum, sesID, 0x1, input);
    seqNum++;  
    clearTimeout(timeout);
    timeout = setTimeout(sendGoodbye, 30000);
});

// send goodbye on the close event
rl.on('close', () => {
  //console.log("rl is closing");
  sendGoodbye();
  setTimeout(client.close, 30000);
});

// on std input, send a data message to server
//process.stdin.on('data', function (data) {
//  messages.sendMessage(client;, PORT, HOST, seqNum, sesID, 0x1, data.slice(0,-1));
//  seqNum++;  
//  clearTimeout(timeout);
//  timeout = setTimeout(sendGoodbye, 30000);
//});

// Helper functions
function sendGoodbye () {
  messages.sendMessage(client, PORT, HOST, seqNum, sesID, 0x3);
}
