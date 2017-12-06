// this file contains the main router logic for the Tor61 node

var net = require('net');
var events = require('events');
var util = require('util');
var cells = require('./cells');
var connections = require('./connections');
var stream = require('./stream');
var registration = require('../proj1/client');
var proxy = require('./streamConnections/proxy');

const TIMEOUT = 4000; // timeout in ms
const MAX_TRIES = 5; // max tries
const LOGGING = true;
const CIRCUIT_LENGTH = 1; // desired circuit length

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
    router.openConns.set(contents["openerID"], TCPRouterConn);
  });

  router.on('opened', (contents, TCPRouterConn) => {
    router.logger("OPENED");
    // save the router connection
    router.openConns.set(contents["openedID"], TCRRouterConn);

  });

  router.on('openFailed', () => {
    router.logger("OPEN FAILED");
    // TODO: implement. When does this happen, and what should we do?
  });

  router.on('createFailed', () => {
    router.logger("CREATE FAILED");
    router.agent.sendCommand(FETCH_COMMAND);
  });

  // on a create message we put the router into our tables and make an outStream
  router.on('create', (contents, TCPRouterConn) => {
    router.logger("CREATE");

    // create a circuit object
    var inCircuitID = contents["circuitID"];
    var inRouterID = contents["routerID"];
    var outCircuitID = makeCircuitID(router, TCPRouterConn);
    var outRouterID = -1;
    var circ = new Circuit(inCircuitID, outCircuitID, inRouterID, outRouterID);

    // update maps in router
    router.inCircuitIDToOutCircuitID.set(inCircuitID, outCircuitID);
    router.outCircuitIDToCircuit.set(outCircuitID, circ);
  });

  router.on('created', (contents, TCPRouterConn) => {
    router.circuitLength++;

    // update maps
    router.circuitID = contents["circuitID"]; //use the circuitID we used to create
    router.circuitIDToRouterID.set(contents["circuitID"], TCPRouterConn.destRouterID);
    router.logger("CREATED");

    if (router.circuitLength < CIRCUIT_LENGTH) {
      router.logger("EXTENDING...");
      circuitExtend(router, 0);
    } else {
      router.emit('circuitEstablished');
    }
  });

  router.on('send', (data) => {
    // sends data along our circuit
    router.logger("attemping to send data over our circuit");

    // TODO: implement sending data
  });


  router.on('relay', (contents, TCPRouterConn) => {
    var outgoingCirc = router.circuitMap([contents["circuitID"],
                                  TCPRouterConn.destRouterID]);
    router.logger("got a relay message on circ = " + outgoingCirc);
    if (router.circuitMap([contents["circuitID"],
                          TCPRouterConn.destRouterID]) == -1) {
      // this is the end of the current circuit
      router.logger("we've got a message for the end of the circuit!");

      // TODO: handle

    } else {
      router.logger("handing off a relay");

    }
  });

  router.on('circuitEstablished', () => {
    router.logger('circuit established, listening on ' + PROXY_PORT);

    router.inProxy = proxy.makeInProxy(router, PROXY_PORT);
  });

  // Failed to create a TCP connection, remove the bad router from availible routers and try again
  router.on('createFailed', (TCPRouterConnection) => {
    console.log("failed to create a TCP connection with " + TCPRouterConnection.destRouterID);
    // probably want to kick off the create again with another fetch?
    // router.agent.sendCommand("f Tor61Router-" + groupID + "-" + instanceNum);
  });

  // issue fetch request, this kicks off the createCircuit function
  router.agent.sendCommand("f Tor61Router-" + groupID + "-");

  // start trying to create a circuit
  createCircuit(router, 0);

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
//  
//  proxyListener: TCP server connection which receives initiations from
//    browsers
//  streamCount: count of streams we've made so far, start at 1
//  outStreams: map from streamID -> outStream, see stream.js. These are
//    streams which end here. Need this map to look up the connection
//    with the server when we go off the network
//  inProxy: HTTP proxy for browser-router communications
//  outProxy: HTTP proxy for router-server communications
//  circuitCount: count of circuits we've seen so far
//  circuitID: the circuit id this starts with
//  circuitLength: the current length of the circuit starting at this router
//  
//  openConns: map from routerIDs to TCPRouterConnections
//  inCircuitIDToOutCircuitID: a map from non-local circuitIDs to local circuitIDs
//  outCircuitIDToCircuit: a map from local circuitIDs to circuit objects

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
//  outCircuitID: the local circuitID
//    -1 if -1 if circuit ends here
//  inRouterID: the incoming router on this circuit
//    -1 if circuit originates here
//  outRouterID: the outgoing router on this circuit
//    -1 if circuit ends here
function Circuit (inCircuitID, outCircuitID, inRouterID, outRouterID) {
  this.inCircuitID = inCircuitID;
  this.outCircuitID = outCircuitID;
  this.inRouterID = inRouterID;
  this.outRouterID = outRouterID;
}

// established a circuit from router given a list of availableRouters to use in
// the circuit.
function createCircuit (router, inCircuitID, inRouterID, tries) {
  if (tries < MAX_TRIES && router.availableRouters == null) {
    // wait a bit and try again
    setTimeout(createCircuit, TIMEOUT, router, tries + 1);
  } else if (tries < MAX_TRIES) {
    // choose a randomly available router as the next hop in our circuit
    destRouter = router.availableRouters[Math.floor(Math.random()
                                          * router.availableRouters.length)];

    router.logger("number of available routers: "
      + router.availableRouters.length);
    console.log(destRouter);

    // open a TCP connection with that router, if one doesn't already exist
    if (router.openConns.has(destRouter.get("data"))) {
      var conn = router.openConns.get(destRouter.get("data"));

      var outCircuitID = makeCircuitID(router, TCPRouterConn);
      var outRouterID = TCPRouterConn.destRouterID;
      var circ = new Circuit(inCircuitID, outCircuitID, inRouterID, outRouterID);
      // try to create the next hop
      conn.tryCreate(makeCircuitID(router, conn), 0);
    } else {
      var socket = new net.createConnection(destRouter.get("port"),
        destRouter.get("IP"));

      socket.on('connect', () => {
        router.logger("connected to first part of circuit!");
        var conn = new connections.TCPRouterConnection(router, socket,
          destRouter.get("data"));
        // try to create the next hop
        conn.tryCreate(makeCircuitID(router, conn), 0); // wont work
      });

      socket.on('timeout', () => {
        router.logger("open timed out");
        router.emit('createFailed');
      });
    }
  
    
  } else {
    // out of tries and still haven't gotten a result from our fetch request
    console.log("fetch request failed, create circuit failed after "
      + MAX_TRIES + " tries, it's all lost");
  }
}

function extendCircuit(router, tries) {
  // for now, we select a router from the list of available routers we've
  // already gotten
  destRouter = router.availableRouters[Math.floor(Math.random()
                                        * router.availableRouters.length)];

  if (router.openConns.has(destRouter.get("data"))) {
    var conn = router.openConns.get(destRouter.get("data"));
    // try to create the next hop
    conn.tryCreate(router.circuitCount, 0);
    router.ciruitCount++;
  }
}

// generate a circuitID to be used on this TCPConn.
//   even if TCPConn is forward, odd otherwise.
function makeCircuitID (router, TCPRouterConn) {
  var cnt = router.circuitCount;
  router.circuitCount += 2;
  if (TCPRouterConn.forward) {
    cnt += (cnt % 2); // make the circuitID even
  } else {
    cnt += ((cnt + 1) % 2); // make the circuitID odd
  }
  return cnt;
}

// shutdown function
function shutDown(router) {
  router.logger("Shutting down now....");
}

util.inherits(Router, events.EventEmitter);
