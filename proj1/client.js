// Registration Client

// import dgram which offers support for UDP on node
var ip = require('ip')
var dgram = require('dgram');
var readline = require('readline');
var messages = require('./messages');

// HOST nd PORT of the registration service
REG_HOST = 'cse461.cs.washington.edu';
REG_PORT = 46101;

// port that this registration client will be sending on. PORT + 1 will also be used for listening.
PORT = process.argv[2];

var seqNum = 0;

// global message types
var REG = 1;
var REGED = 2;
var FETCH = 3;
var FETCHRESPONSE = 4;
var UNREG = 5;
var PROBE = 6;
var ACK = 7;


// This state variable determines what message we are hoping to see at this moment.

// 0 means we want an ACK
// 1 means we want an Registered message
// 2 means we want a FetchResponse message
// 3 means we're not waiting for anything
var state = 0;
var timeout;

// make our sockets which will be bound to p and p+1
var client_sender = dgram.createSocket('udp4');
var client_listener = dgram.createSocket('udp4');

// listen for messages from registration service. Basically just responds to ACKS
client_listener.on('listening', function () {
  var address = client_listener.address(); //where is this used?
});

// listen for messages from registration service. Listens for response messages
client_sender.on('listening', function () {
  var address = client_sender.address(); //where is this used?
});

//
client_listener.on('message', function (message, remote) {
	// need to process message and send back an ACK if it is a probe
	pMessage = messages.processMessage(message);
	if (pMessage["command"] == PROBE) {
		console.log("I've been probed!");
    // make an ack and send it off
    var ack = messages.makeAck(seqNum);
    messages.sendMessage(client_listener, REG_PORT, REG_HOST, ack);
    rl.prompt();
		seqNum++; //increase seqNum here?
	}

});

client_sender.on('message', function (message, remote) {
	//need to print to console depending on what state we're in.
	pMessage = messages.processMessage(message);

	if (pMessage["command"] == ACK) { //ACK
		if (state == 0) {
			console.log("Success: received ACK");
      state = 3;
		}
	}else if (pMessage["command"] == REGED) { //Registered
		if (state == 1) {
			console.log("Successful: lifetime = " + pMessage["lifetime"]);
      state = 3;
		}
	} else if (pMessage["command"] == FETCHRESPONSE) { //fetch response
		if (state == 2) {

			for (i=0; i < pMessage["numEntries"]; i++) {

				console.log("[" + (i+1) + "] " + pMessage["entries"][i].get("IP") + " " + 
					pMessage["entries"][i].get("port") + " " + pMessage["entries"][i].get("data"));
			}

      state = 3;
		}
	}
	rl.prompt(); // print the prompt again once we get a message back.
});

// create a read line interface
var rl = readline.createInterface(process.stdin, process.stdout, null);

rl.setPrompt('Enter r(egister), u(nregister), f(etch), p(robe), or q(uit): ');
rl.prompt();

rl.on('line', function(text) {
  
  ln = text.split(" ")

  if (ln[0] == "r") { //send register

  	if (ln.length != 4) {
  		console.log("Please provide portNum, data, and serviceName");
  	}

    portNum = ln[1];
    data = ln[2];
    serviceName = ln[3];
    serviceIP = ip.address();
    state = 1;
    var reg = messages.makeRegister(seqNum, serviceIP, portNum, data, serviceName);
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, reg);
    seqNum++;
  } else if (ln[0] == "u") { //send Unregister
  	if (ln.length != 2) {
  		console.log("Please provide portNum");
      rl.prompt();
      return;
  	}

  	portNum = ln[1];
  	state = 0;
    var unreg = messages.makeUnregister(seqNum, portNum);
  	messages.sendMessage(client_sender, REG_PORT, REG_HOST, unreg);
  	seqNum++;

  } else if (ln[0] == "f") { //send fetch

  	if (ln.length == 2) {
  		serviceNamePrefix = ln[1];
  	} else {
  		serviceNamePrefix = "";
  	}
  	  	
  	state = 2;
    var fetch = messages.makeFetch(seqNum, serviceNamePrefix);
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, fetch);
  	seqNum++;
  
  } else if (ln[0] == "p") { //send Probe
  	state = 0;

    var probe = messages.makeProbe(seqNum);
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, probe);
  	seqNum++;

  } else if (ln[0] == "q") { //quit

    //do we need to unregister first?
  	process.exit(0);
  
  } else {

  	console.log("not a valid command!");
  	rl.prompt();

  }

});

client_sender.bind(parseInt(PORT));
client_listener.bind(parseInt(PORT) + 1);

function checkForResponse(cmd, tries) {
  if (cmd == ACK) {
    if (state == 0 && tries < 3) {
      // we haven't gotten an ACK; send another
      // resend
    }
  }
}

