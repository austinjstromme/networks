// non-thread based implementation of a P0P server

// note we can read in command line args using process.argv, which simply return
// an array with the command line arguments passed to the process
var PORT = process.argv[2];

// import dgram which offers support for UDP on node
var dgram = require('dgram');
var messages = require('../utils/messages');
var readline = require('readline');

// make our server
var server = dgram.createSocket('udp4');

// set response types
const HELLO = 0;
const DATA = 1;
const ALIVE = 2;
const GOODBYE = 3;

// this is the data structure which maps from session
// ids to session objects
var sessions = new Map();

var timeout = setTimeout(sendGoodbyes, 30000);

server.on('listening', function () {
  var address = server.address();
  console.log('Waiting on port ' + address.port + '...');
});

server.on('message', function (message, remote) {
  // we've received a message - process it; but first cull
  cull(sessions);

  // clear the old timeout
  clearTimeout(timeout);
  // set the new timeout
  timeout = setTimeout(sendGoodbyes, 30000);

  // now process the message
  var pMessage = messages.processMessage(message);
  var command = pMessage["command"];

  if (!pMessage["valid"]) {
    console.log("invalidly formatted message!");
    return;
  }

  // now handle it
  if (command == 0x0) {
    console.log("we got a hello!")
    handleHello(sessions, pMessage, remote);
    return;
  }

  if (!sessions.has(pMessage["sesID"])) {
    // malformed
    return;
  }

  var session = sessions.get(pMessage["sesID"]);

  // update time
  session["time"] = getTime();

  // now update the seqNum

  // we expect dif == 1
  var dif = pMessage["seqNum"] - session["seqNum"];

  if (dif == 0) {
    // print duplicate packet and discard this one
    console.log("duplicate packet");
    return;
  } else if (dif < 0) {
    // sequence number is "from the past", so we say goodbye and end the session
    // which is the same as handle goodbye
    handleGoodbye(sessions, pMessage);
    return;
  }

  session["seqNum"] = pMessage["seqNum"];

  // for each lost packet, print "lost packet"
  while (dif > 1) {
    dif--;
    console.log("lost packet");
  }

  if (command == 0x1) {
    handleData(sessions, pMessage);
  } else if (command == 0x2) {
    handleAlive(sessions, pMessage);
  } else if (command == 0x3) {
    handleGoodbye(sessions, pMessage);
  } else {
    // malformed
    return;
  }

});


server.bind(PORT);

// below we handle reading from stdin
var closed = false;

// this is nice
var rl = readline.createInterface(process.stdin, process.stdout, null);

rl.on('line', function(text) {
  if (text == "q") {
    if (!closed) {
      server.close();
      closed = true;
    }
    rl.close();
  }
});

rl.on('close', function() {
  // if we haven't closed the server, go ahead and close it up
  if (!closed) {
    server.close();
  }
  // exit out
  process.exit(0);
});

// helper functions

function sendGoodbyes() {
  for (var x of sessions.keys()) {
    // say goodbye
    respond(sessions.get(x), GOODBYE);
  }
  sessions.clear();
}

// handles hellos for the server
function handleHello(sessions, pMessage, remote) {
  if (sessions.has(pMessage["sesID"])) {
    // if the session is already active, delete the session and say goodbye
    // this is the same as handleGoodbye, so just use it
    handleGoodbye(sessions, pMessage);
    return;
  }

  // otherwise save the session and respond appropriately
  var session = {};
  session["time"] = getTime();
  session["sesID"] = pMessage["sesID"];
  session["clientAddress"] = remote.address;
  session["clientPort"] = remote.port;
  session["seqNum"] = 0;

  sessions.set(pMessage["sesID"], session);

  console.log(session["sesID"] + ' [0] Session created')

  // now respond
  respond(session, HELLO);
}

function handleData(sessions, pMessage) {
  // update time then print the payload and then respond
  var session = sessions.get(pMessage["sesID"]);

  session["time"] = getTime();

  console.log(session["sesID"] + ' [' + session["seqNum"]
    + '] ' + pMessage["data"]);

  // now respond
  respond(session, ALIVE);
}

function handleAlive(sessions, pMessage) {
  // update time and then respond
  var session = sessions.get(pMessage["sesID"]);

  session["time"] = getTime();
  respond(session, ALIVE);
}

function handleGoodbye(sessions, pMessage) {
  // respond then delete
  var session = sessions.get(pMessage["sesID"]);
  console.log(session["sesID"] + ' [' + session["seqNum"]
    + '] GOODBYE from client')

  respond(session, GOODBYE);

  sessions.delete(pMessage["sesID"]);

  console.log(session["sesID"] + ' Session closed')
}

// responds to session with response type type (defined above)
function respond(session, type) {
  messages.sendMessage(server, session["clientPort"],
    session["clientAddress"], session["seqNum"], session["sesID"],
    type);
}

// return the current time since 1970 in seconds
function getTime() {
  return (new Date().getTime()/1000);
}

// cull the old sessions
function cull(sessions) {
  // iterate over sessions and kill the ones which are too old; send goodbye

  for (var [key, val] of sessions.entries()) {
    if ((getTime - val["time"]) > 30) {
      respond(val, GOODBYE);
      sessions.delete(key);
    }
  }
}

