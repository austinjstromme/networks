// this file contains the main router logic for the Tor61 node

var net = require('net');
var events = require('events');
var util = require('util');
var cells = require('./cells');
var connections = require('./connections');
var stream = require('./stream');
var registration = require('../proj1/client');
var proxy = require('./streamConnections/proxy');

const TIMEOUT = 3000; // timeout in ms
const MAX_TRIES = 5; // max tries
const LOGGING = true;
const CIRCUIT_LENGTH = 3; // desired circuit length

// returns a fresh router binded to this port
// this is where all of the logic of the router is 
exports.makeRouter = function (port, groupID, instanceNum) {
  const FETCH_COMMAND = ("f Tor61Router-" + groupID + "-");
  const PROXY_PORT = port + 1; // this ok?

  // first create a router object
  var router = new Router(port, groupID, instanceNum);
  router.outProxy = proxy.makeOutProxy(router, port + 2);

  router.on('fetchResponse', (fetchResult) => {
    if (fetchResult.length == 0) {
      router.logger("fetchResult returned with nothing, trying again");
      router.agent.sendCommand(FETCH_COMMAND);
    } else {
      router.logger("fetchResult returned with results");
      // save the available routers
      router.availableRouters = fetchResult;
    }
  });

  router.on('open', (contents, TCPRouterConn) => {
    router.logger("OPEN");
    if (router.openConns.has(contents["openerID"])) {
      router.logger("superfluous open (should send back openFailed?)");
    } else {
      router.logger("setting openConns");
      router.openConns.set(contents["openerID"], TCPRouterConn);
    }
  });

  router.on('opened', (contents, TCPRouterConn) => {
    router.logger("OPENED");
    // save the router connection
    if (router.openConns.has(contents["openedID"])) {
      router.logger("superfluous opened");
    } else {
      router.logger("setting openConns");
      router.openConns.set(contents["openedID"], TCPRouterConn);
    }
  });

  router.on('openFailed', () => {
    router.logger("OPEN FAILED");
    // TODO: implement. When does this happen, and what should we do?
  });

  router.on('createFailed', () => {
    router.logger("CREATE FAILED");
    router.agent.sendCommand(FETCH_COMMAND);
  });

  // on a create message we update our tables accordingly
  router.on('create', (contents, TCPRouterConn) => {
    router.logger("CREATE");
    //console.log("TCPRouterConn.forward = " + TCPRouterConn.forward);

    // create a circuit object
    var inCircuitID = contents["circuitID"];
    var inRouterID = TCPRouterConn.destRouterID;
    var outCircuitID = makeCircuitID(router.circuitCount, TCPRouterConn);
    router.circuitCount += 2;
    var outRouterID = -1;
    var circ = new Circuit(inCircuitID, outCircuitID, inRouterID, outRouterID);
    circ.inConn = TCPRouterConn;

    //console.log(circ);

    // update maps in router
    router.logger("setting inCircuitIDToOutCircuitID | " + inCircuitID + ":" + outCircuitID);
    router.inCircuitIDToOutCircuitID.set(inCircuitID, outCircuitID);
    router.logger("setting outCircuitIDToCircuit | " + outCircuitID + ":" + circ);
    router.outCircuitIDToCircuit.set(outCircuitID, circ);
  });

  router.on('created', (contents, TCPRouterConn) => {
    router.logger("CREATED");
    // look up the circuit
    var circ = router.outCircuitIDToCircuit.get(contents["circuitID"]);

    // update the circuit
    circ.outCircuitID = contents["circuitID"];
    circ.outRouterID = TCPRouterConn.destRouterID;
    circ.outConn = TCPRouterConn;
    //console.log("TCPRouterConn.forward = " + TCPRouterConn.forward);

    var iter = router.openConns.values();

    //console.log(circ);

    // separate responses based on whether its our own circuit
    if (circ.inRouterID == -1) {
      router.circuitLength++;
      // save the fact that this is our own circuit
      router.circuitID = contents["circuitID"]
      // we initiated...
      if (router.circuitLength < CIRCUIT_LENGTH) {
        router.logger("EXTENDING...");
        // do some sort of extension
        extendOurCircuit(router);

      } else {
        router.emit('circuitEstablished');
      }
    } else {
      // we had gotten a relay extend and now it's worked, talk back
      router.logger("DO RELAY EXTENDED...");
      // send a relay extended back
      var cell = cells.createRelayCell(circ.inCircuitID, 0x0, 0x07, '');
      //router.openConns.get(circ.inRouterID).socket.write(cell);
      circ.inConn.socket.write(cell);
    }
  });

  router.on('send', (data) => {
    // sends data along our circuit

    //var outRouterID =
    //  router.outCircuitIDToCircuit.get(router.circuitID).outRouterID;
    //var conn = router.openConns.get(outRouterID);
    var circ = router.outCircuitIDToCircuit.get(router.circuitID);
    var conn = circ.outConn;

    conn.socket.write(data);
  });

  router.on('relay', (contents, TCPRouterConn) => {
    //TCPRouterConn = router.openConns.get(TCPRouterConn.destRouterID);
    // This trick allows us to look up which way the message is going
    var forwards = true; // true if this message is going forwards along the
      // circuit
    
    // if the circuitID is even and it is moving in the direction of the
    // TCP connection or if the circuitID is odd and it is moving in the
    // opposite direction, it is moving forward.
    if ((((contents["circuitID"] % 2) == 0) && !TCPRouterConn.forward)
        || (((contents["circuitID"] % 2) == 1) && TCPRouterConn.forward)) {
        forwards = false;
        router.logger("backward direction on relay");
    }

    // get the correct circuit to send messages along
    var circ;
    if (forwards) {
      var outCircuitID = router.inCircuitIDToOutCircuitID.get(contents["circuitID"]);
      circ = router.outCircuitIDToCircuit.get(outCircuitID);
    } else {
      circ = router.outCircuitIDToCircuit.get(contents["circuitID"]);
    }

    // var circ = router.inCircuitIDToOutCircuitID.get(contents["circuitID"]);

    //console.log("relay message on circuit = ");
    //console.log(circ);

    if (circ.outRouterID == -1) { // we are the end of the circuit
      router.logger("we've got a message for the end of the circuit!");
      if (contents['relayCmd'] == 0x01) {  // begin
        // TODO: do what we need to here to save some sort of outStream
        // send back that we've connected
        TCPRouterConn.socket.write(cells.createRelayCell(contents["circuitID"],
                                                  contents["streamID"],
                                                  0x04,
                                                  ""));
      } else if (contents['relayCmd'] == 0x02) { // stream data
        router.logger("received body with length = " + contents['body'].length);
      } else if (contents['relayCmd'] == 0x03) { // end request
        // TODO: implement
      } else if (contents['relayCmd'] == 0x04) { // connected
        router.logger("UNEXPECTED: connected at end of circuit");
      } else if (contents['relayCmd'] == 0x06) { // extend request

        router.logger("got extend request for end of circuit");
        contents['body']; // ip:port\0<agent id>
        var agentID = parseInt(contents['body'].split('\0')[1]);
        var tokens = contents['body'].split('\0')[0].split(':');
        var IP = tokens[0];

        for (var i = 1; i < tokens.length - 1; i++) {
          IP += (":" + tokens[i]);
        }
        var port = tokens[tokens.length - 1];

        reliableCreate(router, circ, outCircuitID, agentID, IP, port, 0);

      } else if (contents['relayCmd'] == 0x07) { // extended
        router.logger("UNEXPECTED: extended at end of circuit");
      } else if (contents['relayCmd'] == 0x0b) { // begin failed
        router.logger("UNEXPECTED: begin failed at end of circuit");
      } else if (contents['relayCmd'] == 0x0c) { // extend failed
        router.logger("UNEXPECTED: extend failed at end of circuit");
      }

    } else if (circ.inRouterID == -1) { // we are the beginning of the circuit
      router.logger("we've got a message for the begin of the circuit!");
      if (contents['relayCmd'] == 0x01) { // begin
        router.logger("UNEXPECTED: connect at begin of circuit");
      } else if (contents['relayCmd'] == 0x02) { // stream data
        router.logger("UNEXPECTED: stream data at begin of circuit");
      } else if (contents['relayCmd'] == 0x03) { // end request
        router.logger("UNEXPECTED: end at begin of circuit");
      } else if (contents['relayCmd'] == 0x04) { // connected
        router.logger("received a connected");
        // begin succeeded - emit an opened for the inStream
        var inStream = router.inStreamIDToInStream.get(contents['streamID']);
        inStream.emit('opened');
      } else if (contents['relayCmd'] == 0x06) { // extend request
        router.logger("UNEXPECTED: extend at begin of circuit");
      } else if (contents['relayCmd'] == 0x07) { // extended
        router.logger("RELAY EXTENDED!");
        router.circuitLength++;
        if (router.circuitLength < CIRCUIT_LENGTH) {
          router.logger("EXTENDING...");
          // do some sort of extension
          extendOurCircuit(router);
        } else {
          router.emit('circuitEstablished');
        }
      } else if (contents['relayCmd'] == 0x0b) { // begin failed
        // begin failed - emit an openFailed for the inStream
        var inStream = router.inStreamIDToInStream.get(contents['streamID']);
        router.delete(contents['streamID']);
        inStream.emit('openFailed');
      } else if (contents['relayCmd'] == 0x0c) { // extend failed
        // extend failed - do something
        router.emit('extendCircuitFailed');
      }
    } else { // hand off the relay
      /*var routerID;
      var circuitID;
      console.log("direction = " + forwards);
      if (forwards) { // hand it forwards
        routerID = circ.outRouterID;
        circuitID = circ.outCircuitID;
      } else { // hand it backwards
        routerID = circ.inRouterID;
        circuitID = circ.inCircuitID;
      }
      router.logger("handing off a relay, inCircuitID = " + circuitID);
      var msg = cells.createRelayCell(circuitID, contents['streamID'], contents['relayCmd'], contents['body']);
      conn.socket.write(msg); // send the relay along*/

      var circuitID;
      var conn;

      if (forwards) { // hand it forwards
        circuitID = circ.outCircuitID;
        conn = circ.outConn;
      } else { // hand it backwards
        circuitID = circ.inCircuitID;
        conn = circ.inConn;
      }
      var msg = cells.createRelayCell(circuitID,
                                     contents['streamID'],
                                     contents['relayCmd'],
                                     contents['body']);

      conn.socket.write(msg);
    }

  });

  router.on('circuitEstablished', () => {
    console.log("circuitEstablished!");
    if (router.inProxy != null) { // this has already been called
      return;
    } else {
      router.inProxy = proxy.makeInProxy(router, PROXY_PORT);
    }
  });

  // emitted when our extend circuit failed for one reason or another
  router.on('extendCircuitFailed', () => {
    // TODO: implement
    router.logger('EXTEND CIRCUIT FAILED');
  });

  // Failed to create a TCP connection, remove the bad router from availible routers and try again
  router.on('createFailed', (TCPRouterConnection) => {
    router.logger("failed to create a TCP connection with " + TCPRouterConnection.destRouterID);
    // probably want to kick off the create again with another fetch?
    // router.agent.sendCommand("f Tor61Router-" + groupID + "-" + instanceNum);
  });

  // issue fetch request, this kicks off the createCircuit function
  router.agent.sendCommand("f Tor61Router-" + groupID + "-");

  // start trying to create a circuit, starting with us
  var circ = new Circuit(-1, -1, -1, -1);
  makeFirstHop(router, circ, 0);

  // now that we've created the router, initiate create circuit
  return router;
}

// A router object will contain
//  agent: an Agent to handle registration
//  availableRouters: list of available routers; null if none
//  port: see below
//  routerListener: TCP server connection which receives initiations from
//    other routers
//  instanceNum: the instanceNum of this router
//  groupID: the id of our group, common to all of our routers
//  id: (groupID << 16) || instanceNum
//  proxyListener: TCP server connection which receives initiations from
//    browsers
//
//  circuitCount: count of circuits we've seen so far
//  circuitID: the circuit id this starts with
//  circuitLength: the current length of the circuit starting at this router
//  openConns: map from routerIDs to TCPRouterConnections
//  inCircuitIDToOutCircuitID: a map from non-local circuitIDs to local circuitIDs
//  outCircuitIDToCircuit: a map from local circuitIDs to circuit objects
//
//  streamCount: count of streams we've made so far, start at 1
//  inStreamIDToInStream: map from inStreamID -> inStream
//  outStreamIDToOutStream: map from outStreamID -> outStream
//  inProxy: HTTP proxy for browser-router communications
//  outProxy: HTTP proxy for router-server communications
//
//  Port usage shall be as follows:
//    port     | listener for connections with other Tor61 routers
//    port + 1 | inProxy
//    port + 2 | outProxy
//    port + 3 | registrationAgent's port for agent -> service communications
//    port + 4 | registrationAgent's port for service -> agent communications
function Router(port, groupID, instanceNum) {
  this.agent = new registration.registrationAgent(port + 3, this); // where did this port come from?
  this.port = port;
  this.groupID = groupID;
  this.instanceNum = instanceNum;
  this.availableRouters = null;
  this.circuitLength = 0; // The circuit is currently just this router
  this.circuitCount = 3; // Every circuit starts with the id of 1.
  this.circuitID = 2; // the id of the circuit startting on this router
  this.id = (this.groupID << 16) || this.instanceNum;
  this.streamCount = 1; // Streams start at 1 (0 is reserved)
  this.inProxy = null;
  this.outProxy = null;

  // Initialize openConns, a map of all open TCP connections to this router
  this.openConns = new Map();

  // Initialize inCircuitIDToOutCircuitID, a map which maps from global to local circuit ids
  this.inCircuitIDToOutCircuitID = new Map();

  // Initialize circuitLookup, a map from local circuit ids to circuit objects
  this.outCircuitIDToCircuit = new Map();

  this.inStreamIDToInStream = new Map();
  // Initialize circuitMap, a map of ingoing to outgoing circuit numbers
  // this.circuitMap = new Map();
  // Initialize circuitIDToRouterID, a map from circuit number to 
  // this.circuitIDToRouterID = new Map();

  // STEP 0: bind a socket to listen on port
  this.routerListener = new connections.routerListener(this, port);
  // STEP 1: Register self using agent
  this.agent.sendCommand("r " + this.port + " " + this.id + " " +  "Tor61Router-" + groupID + "-" + instanceNum);

  this.logger = (data) => {
    if (LOGGING) {
      console.log("Tor61Router-" + this.id + ": " + data);
    }
  }
}

// A Circuit object contains
//  inCircuitID: the non-local circuitID
//    -1 if circuit originates here
//  outCircuitID: the local circuitID NOTE: THIS CAN'T BE -1 BECAUSE THEN OUR
//    LOOKUPS DON'T WORK
//  inRouterID: the incoming router on this circuit
//    -1 if circuit originates here
//  outRouterID: the outgoing router on this circuit
//    -1 if circuit ends here
//
//  inConn: TCPRouterConn holding the in socket, initialized to null
//  outConn: TCPRouterConn holding the out socket, initialized to null
function Circuit (inCircuitID, outCircuitID, inRouterID, outRouterID) {
  this.inCircuitID = inCircuitID;
  this.outCircuitID = outCircuitID;
  this.inRouterID = inRouterID;
  this.outRouterID = outRouterID;

  this.inConn = null;
  this.outConn = null;
}


// implements reliable create
function reliableCreate (router, circuit, outCircuitID, outRouterID,
                        IP, port, tries) {
  if (circuit.outRouterID != -1) {
    // done
    return;
  } else if (tries < MAX_TRIES) {
    // open a TCP connection with that router, if one doesn't already exist
    if (router.openConns.has(outRouterID)) {
      var conn = router.openConns.get(outRouterID);

      // make sure things are pointing correctly - possibly
      // delete the old circuitID from the map
      outCircuitID = makeCircuitID(outCircuitID, conn);
      router.inCircuitIDToOutCircuitID.set(circuit.inCircuitID,
                                           outCircuitID);
      router.outCircuitIDToCircuit.set(outCircuitID, circuit);
      circuit.outCircuitID = outCircuitID;
      // console.log("sending create with");
      // console.log(circuit);

      // try to create the next hop
      conn.sendCreate(outCircuitID);
    } else {
      var socket = new net.createConnection(port, IP);

      socket.on('connect', () => {
        // in the mean time it was opened
        if (router.openConns.has(outRouterID)) {
          return;
        }
        router.logger("connected to " + outRouterID);
        var conn = new connections.TCPRouterConnection(router, socket,
          outRouterID);

        // make sure things are pointing correctly
        outCircuitID = makeCircuitID(outCircuitID, conn);
        router.inCircuitIDToOutCircuitID.set(circuit.inCircuitID,
                                             outCircuitID);
        router.outCircuitIDToCircuit.set(outCircuitID, circuit);
        circuit.outCircuitID = outCircuitID;

        // try to create the next hop
        conn.sendCreate(outCircuitID, 0); // wont work
      });

      socket.on('timeout', () => {
        router.logger("open to " + outRouterID + " failed... malformed IP/port?");
        // TODO: createFailed will take more arguments
        router.emit('createFailed', circuit);
      });
    }

   setTimeout(reliableCreate,
              TIMEOUT,
              router,
              circuit,
              outCircuitID,
              outRouterID,
              IP,
              port,
              tries + 1);
  } else {
    // out of tries and still haven't created
    router.logger("create circuit failed after " + MAX_TRIES + " tries, fuck");
    router.emit('createFailed', circuit);
  }
}

// establish the first link in the circuit originating on this router
function makeFirstHop(router, circuit, tries) {
  if (router.availableRouters != null) {
    // for now, we select a router from the list of available routers we've
    // already gotten
    destRouter = router.availableRouters[Math.floor(Math.random()
                                          * router.availableRouters.length)];

    reliableCreate(router, circuit, router.circuitID,
                  parseInt(destRouter.get('data')), destRouter.get('IP'),
                  destRouter.get('port'), 0);

  } else if (tries < MAX_TRIES) {
    // see if we've gotten some routers back from reg agent in TIMEOUT
    setTimeout(makeFirstHop, TIMEOUT, router, circuit, tries + 1);
  } else {
    // no router back from reg agent after MAX_TRIES tries
    router.logger("no fetchResponse to start making circuit with");
  }
}

function reliableExtend (router, body, oldLength, tries) {
  if (router.circuitLength > oldLength) {
    return;
  } else if (tries < MAX_TRIES) {
    router.logger("doing another reliable extend");
    // circuitID, streamID, relayCmd, body
    var relayExtendCell = cells.createRelayCell(router.circuitID, 0x00, 0x06, body);
    router.emit('send', relayExtendCell);

    setTimeout(reliableExtend, TIMEOUT * 3, router, body, oldLength, tries + 1);
  } else { 
    router.emit('extendCircuitFailed');
  }
}

function extendOurCircuit (router) {
  destRouter = router.availableRouters[Math.floor(Math.random()
                                          * router.availableRouters.length)];

  var body = destRouter.get('IP') + ":" + destRouter.get('port') + '\0' + destRouter.get('data');

  reliableExtend(router, body, router.circuitLength, 0);
}

// generate a circuitID to be used on this TCPConn.
//   even if TCPConn is forward, odd otherwise.
function makeCircuitID (circuitID, TCPRouterConn) {
  if (TCPRouterConn.forward) {
    circuitID += ((circuitID + 1) % 2); // make the circuitID odd
  } else {
    circuitID += (circuitID % 2); // make the circuitID even
  }
  return circuitID;
}

// shutdown function
function shutDown(router) {
  router.logger("Shutting down now....");
}

util.inherits(Router, events.EventEmitter);
