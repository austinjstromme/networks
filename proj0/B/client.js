// non-hread based implementation of a P0P client

// host and port give the location of the server
var HOST = process.argv[2];
var PORT = process.argv[3];

// import dgram which offers support for UDP on node
var dgram = require('dgram');
var messages = require('../utils/messages');

// make our server
var client = dgram.createSocket('udp6');

// generate a random session ID
var sesID = Math.floor(Math.random() * (Math.pow(2, 32) - 1));

// sequence number to keep track of correspondence
var seqNum = 0;

// after 30 seconds of no activity send GOODBYE and close
var timeout = setTimeout(sendGoodbye, 3000000);

// listen for messages from server
client.on('listening', function () {
  var address = client.address();
  console.log('Listening on ' + address.address + ':'
    + address.port);

  messages.sendMessage(client, PORT, HOST, seqNum, sesID, 0x0);

});

client.on('message', function () {
  // now process the message
  var pMessage = messages.processMessage(message);
  var command = pMessage["command"];

  if (command == 0x0) { //
  	clearTimeout(timeout);
  	var timeout = setTimeout(sendGoodbye, 3000000);
  } else if (command == 0x2) { //
  	clearTimeout(timeout);
  	var timeout = setTimeout(sendGoodbye, 3000000);
  } else if (command == 0x3) { //
  	client.close();
  }

})

// on std input, send a data message to server
process.stdin.on('data', function (data) {

  messages.sendMessage(client, PORT, HOST, seqNum, sesID, 0x1, data);
  seqNum++;
  
  clearTimeout(timeout);
  var timeout = setTimeout(sendGoodbye, 30000);

});

//client.bind(69696);

// Helper functions
function sendGoodbye () {
  console.log("sending goodbyes!");
  messages.sendMessage(client, PORT, HOST, seqNum, sesID, 0x3);

}