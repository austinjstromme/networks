// Reggistration Client

// import dgram which offers support for UDP on node
var dgram = require('dgram');
var readline = require('readline');
var messages = require('./messages');

// HOST nd PORT of the registration service
REG_HOST = 'cse461.cs.washington.edu';
REG_PORT = 46101;

PORT = process.argv[2];

var seqNum = 0;

// make our sockets which will be bound to p and p+1
var client_sender = dgram.createSocket('udp4');
var client_listener = dgram.createSocket('udp4');

// listen for messages from registration service. Listens for response messages
client_sender.on('listening', function () {
  var address = client_sender.address();
  //console.log('Sender waiting on port ' + address.port + '...');
});

// listen for messages from registration service. Basically just responds to ACKS
client_listener.on('listening', function () {
  var address = client_listener.address();
  //console.log('Listener waiting on port ' + address.port + '...');
});

client_sender.on('message', function (message, remote) {
	//need to print to console depending on what state we're in.
	console.log(message);
});

client_listener.on('message', function (message, remote) {
	//need to  process message and send back an ACK if it is a probe
	pMessage = messages.processMessage(message);
	if (pMessage["command"] == 7) {
		messages.sendACK(client_listener, REG_PORT, REG_HOST, seqNum);
		seqNum++; //increase seqNum here?
	}

});

// create a read line interface
var rl = readline.createInterface(process.stdin, process.stdout, null);

rl.on('line', function(text) {
  ln = text.split(" ")

  if (ln[0] == "r") { //send register

  	if (ln.length != 4) {
  		console.log("Please provide portNum, data, and serviceName");
  	}

    portNum = ln[1];
    data = ln[2];
    serviceName = ln[3];
    serviceIP = client_sender.address.address;
    messages.sendRegister(client_sender, REG_PORT, REG_HOST, seqNum, IP, portNum, data, serviceName);
    seqNum++;

  } else if (ln[0] == "u") { //send Unregister
  	
  	portNum = ln[1];
  	messages.sendUnregister(client_sender, REG_PORT, REG_HOST, seqNum, portNum);
  	seqNum++;

  } else if (ln[0] == "f") { //send fetch
  	
  	serviceNamePrefix = ln[1];
  	messages.sendFetch(client_sender, REG_PORT, REG_HOST, seqNum, serviceNamePrefix);
  	seqNum++;
  
  } else if (ln[0] == "p") { //send Probe
  
  	messages.sendProbe(client_sender, REG_PORT, REG_HOST, seqNum);
  	seqNum++;

  } else if (ln[0] == "q") { //quit
  	
    //do we need to unregister first?
  	process.exit(0);
  
  } else {
  
  	console.log("not a valid command!");
  }
});

client_sender.bind(parseInt(PORT));
client_listener.bind(parseInt(PORT) + 1);