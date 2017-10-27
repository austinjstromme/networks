// Registration Client

// import dgram which offers support for UDP on node
var ip = require('ip');
var dgram = require('dgram');
var readline = require('readline');
var messages = require('./messages');

// HOST and PORT of the registration service
REG_HOST = 'cse461.cs.washington.edu';
REG_PORT = 46101;

// port that this registration client will be sending on. PORT + 1 will also be used for listening.
PORT = process.argv[2];

var seqNum = 0; // global sequence number for all messages sent
var sessions = new Map(); // a Map of ports that we currently have registered

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
// 1 means we want a FetchResponse message
// 2 means we're not waiting for anything
var agentState = 2;
var timeout;

// make our sockets which will be bound to ports p and p+1
var client_sender = dgram.createSocket('udp4');
var client_listener = dgram.createSocket('udp4');

//listener socket just responds to ACKs sent by the server
client_listener.on('message', function (message, remote) {

  // need to process message and send back an ACK if it is a probe
  pMessage = messages.processMessage(message);
  if (pMessage["command"] == PROBE) {
    console.log();
    console.log("I've been probed!");
    
    // make an ack and send it off
    var ack = messages.makeAck(pMessage["seqNum"]);
    messages.sendMessage(client_listener, remote.port, REG_HOST, ack);
    rl.prompt();
  }
});

//primary socket for communicating with registration service
client_sender.on('message', function (message, remote) {
  
  pMessage = messages.processMessage(message);

  if (pMessage["command"] == ACK) { //ACK
    // check to see if the ack was in response to a session unreging
    sessions.forEach(function (session, port, map) {
      if (session.seqNum == pMessage["seqNum"]) {
        // if session is closing down, delete it since this is what we've
        // been waiting for
        if (session.state == 2) {
          session.state = 3
          console.log("Success: received ACK");
          sessions.delete(port);
          return;
        }
      }
    });

    // it wasn't in response to a session unreging
    // if it's in response to a probe, agentState transitions
    if (agentState == 0) {
      agentState = 2;
      console.log("Success: received ACK");
    }
    // else it was erroneous
  } else if (pMessage["command"] == REGED) { // Registered
    // get the port that this message corresonds to
    var registered;
    sessions.forEach(function (session, port, map) {
      if (session.seqNum == pMessage["seqNum"]) {
        if (session.state == 0) {
          session.state = 1;
        } else {
          // erroneous registered
          return;
        }
        registered = port;
      }
    });

    console.log("Successful: lifetime of port " + registered + " is "
      + pMessage["lifetime"] + " seconds");

    // set a timer to register the port again after lifetime seconds
    var timer = setTimeout(stayRegistered,
      ((pMessage["lifetime"] * 1000) - 2)/4, registered);

  } else if (pMessage["command"] == FETCHRESPONSE) { // fetch response
    if (agentState == 1) {
      for (i = 0; i < pMessage["numEntries"]; i++) {
        console.log("[" + (i+1) + "] " + pMessage["entries"][i].get("IP") + " "
          + pMessage["entries"][i].get("port") + " "
          + pMessage["entries"][i].get("data"));
      }
      agentState = 2;
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

  if (ln[0] == "r") { // send register

    if (ln.length != 4) {
      console.log("Please provide portNum, data, and serviceName");
      rl.prompt();
      return;
    }
    if (parseInt(ln[1]) > 65535) {
      console.log("Please enter a valid port number");
      rl.prompt();
      return;
    }

    portNum = parseInt(ln[1]);
    data = ln[2];
    serviceName = ln[3];
    serviceIP = ip.address();
    
    // make a new session object and store it
    var portSession = new session(portNum, data, serviceName);
    sessions.set(portNum, portSession);

    // make the reg message and try to send it
    var reg = messages.makeRegister(seqNum, serviceIP, portNum, data, serviceName);
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, reg);
    seqNum++;
    var tries = 0;
    setTimeout(checkForResponseForSession, 4000, reg, tries, "REG", portSession, 1);
  } else if (ln[0] == "u") { //send Unregister

    if (ln.length != 2) {
      console.log("Please provide portNum");
      rl.prompt();
      return;
    }

    portNum = parseInt(ln[1]);
    if (!sessions.has(portNum)) {
      console.log("We do not have that portNum registered");
      rl.prompt();
      return;
    }
    portSession = sessions.get(portNum);

    serviceIP = ip.address();
    console.log("serviceIP = " + serviceIP);

    var unreg = messages.makeUnregister(seqNum, serviceIP, portNum);
    // send unregister message and transition portSession
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, unreg);
    // we have to update the seqNum here
    portSession.seqNum = seqNum;
    portSession.state = 2;
    seqNum++;
    var timer = setTimeout(checkForResponseForSession, 4000, unreg, 0, "UNREG",
      portSession, 3);
  } else if (ln[0] == "f") { // send fetch

    if (ln.length == 2) {
      serviceNamePrefix = ln[1];
    } else {
      serviceNamePrefix = "";
    }
        
    var fetch = messages.makeFetch(seqNum, serviceNamePrefix);
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, fetch);
    agentState = 1;
    seqNum++;
    var tries = 0;
    var timer = setTimeout(checkForResponseForAgent, 4000, fetch, tries, "FETCH", 2);
  } else if (ln[0] == "p") { // send Probe

    var probe = messages.makeProbe(seqNum);
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, probe);
    agentState = 0;
    seqNum++;
    var tries = 0;
    var timer = setTimeout(checkForResponseForAgent, 4000, probe, tries, "PROBE", 2);

  } else if (ln[0] == "q") { //quit

    process.exit(0);
  
  } else {

    console.log("not a valid command!");
    rl.prompt();
    return;

  }

});

client_sender.bind(parseInt(PORT));
client_listener.bind(parseInt(PORT) + 1);

function checkForResponseForSession(message, tries, cmd, session, desired) {
  rl.prompt();
  if (session.state == desired) {
    // got to the desired state, done!
    if (desired == 3) {
      sessions.delete(session.port);
    }
  } else if (tries < 3) {
    console.log("Timed out waiting for reply to " + cmd + " message");
    // resend the message
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, message);
    var timer = setTimeout(checkForResponseForSession, 4000, message, tries + 1,
      session, desired);
  } else {
      console.log("sent 3 " + cmd + " messages but got no reply");
      rl.prompt();
  }
}

// function which sends the message up to three times if it heard no response.
function checkForResponseForAgent(message, tries, cmd, desired) {
  if (agentState == desired) {
    // got to the desired state, done!
  } else if (tries < 3) {
    console.log("Timed out waiting for reply to " + cmd + " message");
    // resend the message
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, message);
    var timer = setTimeout(checkForResponseForAgent, 4000, message, tries + 1,
      desired);
  } else {
      console.log("sent 3 " + cmd + " messages but got no reply");
      rl.prompt();
  }
}

// function to have a port register itself again
function stayRegistered(port) {
  if (sessions.has(port)) { // only register if the port is still in sessions
    sessions.get(port).stayRegistered();
  }
}

//constructor function for making a method obect
function session(port, data, name) {
  this.port = port;
  this.data = data;
  this.name = name;
  this.seqNum = seqNum;
  // 0 corresponds to waiting for registered (to be active)
  // 1 corresponds to not waiting for registered (active)
  // 2 corresponds to waiting for unregistered (to be inactive)
  // 3 corresponds to (inactive)
  this.state = 0
  
  // method for resending a register message on this port. Changes the seqNum
  // to the new seqNum.
  this.stayRegistered = function() {
    serviceIP = ip.address();

    // Reset seqNum. This is important because the registration service will now
    // associate this seqNum to this port.
    this.seqNum = seqNum;
    var reg = messages.makeRegister(this.seqNum, serviceIP, this.port,
      this.data, this.name);
    messages.sendMessage(client_sender, REG_PORT, REG_HOST, reg);
    this.state = 0;
    seqNum++;

    var tries = 0;
    var timer = setTimeout(checkForResponseForSession, 4000, reg, tries, "REG",
      this, 1);
  };
}
