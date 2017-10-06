// non-thread based implementation of a P0P server

// note we can read in command line args using process.argv, which simply return
// an array with the command line arguments passed to the process
var PORT = process.argv[2];

// import dgram which offers support for UDP on node
var dgram = require('dgram');

// make our server
var server = dgram.createSocket('udp6');

// set response types
const HELLO = 0;
const ALIVE = 1;
const GOODBYE = 2;

// this is the data structure which maps from session
// ids to session objects
var sessions = new Map();

server.on('listening', function () {
  var address = server.address();
  console.log('Listening on ' + address.address + ':'
    + address.port);
});

server.on('message', function (message, remote) {
  // we've received a message - process it; but first cull
  cull(sessions);

  // now process the message
  var pMessage = processMessage(message);
  var command = pMessage["command"];

  // now handle it
  if (command == 0x0) {
    handleHello(sessions, pMessage, remote);
    return;
  }

  if (!sessions.has(pMessage["sesID"])) {
    // malformed
    return;
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


// helper functions

// handles hellos for the server
function handleHello(sessions, pMessage, remote) {
  // if the session is already active, delete the session and say goodbye
  if (sessions.has(pMessage["sesID"])) {
    respond(pMessage["sesID"], GOODBYE);
    sessions.delete(pMessage["sesID"]);
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

  // now respond
  respond(session, HELLO);
}

// handles datas for the server
function handleData(sessions, pMessage) {
  // update time then print the payload and then respond
  var session = sessions.get(pMessage["sesID"]);

  session["time"] = getTime();
  for (var x in session["data"]) {
    console.log(x);
  }
  console.log("\n");

  // now respond
  respond(session, HELLO);
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
  respond(session, GOODBYE);

  sessions.delete(pMessage["sesID"]);
}

// responds to session with response type type (defined above)
function respond(session, type) {
  var client = dgram.createSocket('udp6');

  var message = new Buffer([0xC4, 0x61, 0x1, type]);

  message.writeUInt32BE(session["seqNum"], 4);

  client.send(message, 0, message.length, session["clientPort"],
    session["clientAddress"], function (err, bytes) { client.close(); });
}

// process the message
function processMessage(message) {
  var pMessage = {};
  pMessage["valid"] = false;

  if ((message.length < 12 || message[0] != 0xC4 || message[1] != 0x61
    || message[2] != 0x1) {
    // invalid
    return pMessage;
  }

  pMessage["command"] = message[3];
  pMessage["seqNum"] = message.readUInt32BE(4);
  pMessage["sesID"] = message.readUInt32BE(8);

  var iter = message.values();

  for (int i = 0; i < 12; i++) {
    iter.next();
  }

  pMessage["data"] = iter;
}

// return the current time since 1970 in seconds
function getTime() {
  return (new Date().getTime()/1000);
}

// cull the old sessions
function cull(sessions) {
  // iterate over sessions and kill the ones which are too old

  for (var [key, val] of sessions.entries()) {
    if ((getTime - val.["time"]) > 30) {
      sessions.delete(key);
    }
  }
}

