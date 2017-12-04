// this file contains the main router logic for the Tor61 node

var net = require('net');
var events = require('events');
var util = require('util');
var cells = require('./cells');
var connections = require('./connections.js');
var registration = require('../proj1/client.js');

const TIMEOUT = 4000; // timeout in ms
const MAX_TRIES = 5; // max tries
const LOGGING = true;
const CIRCUIT_LENGTH = 1; // desired circuit length

// returns a fresh router binded to this port
// this is where all of the logic of the router is 
exports.makeRouter = function (port, groupID, instanceNum) {
  const FETCH_COMMAND = ("f Tor61Router-" + groupID + "-");

  // first create a router object
  var router = new Router(port, groupID, instanceNum);

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
    // TODO: implement; when does this happen, and what should we do?
  });

  router.on('createFailed', () => {
    router.logger("CREATE FAILED");
    router.agent.sendCommand(FETCH_COMMAND);
  });

  // on a create message we put the router into our tables
  router.on('create', (contents, TCPRouterConn) => {
    router.logger("CREATE");
    var cnt = router.circuitCount++;
    router.circuitMap.set([contents["circuitID"], TCPRouterConn.destRouterID],
      cnt);
    router.circuitIDToRouterID.set(cnt, TCPRouterConn.destRouterID);
  });

  // on a created message we need to send a relay extend
  router.on('created', () => {
    router.circuitLength++;
    router.logger("CREATED");

    if (router.circuitLength < CIRCUIT_LENGTH) {
      router.logger("EXTENDING...");
      circuitExtend(router, 0);
    } else {
      router.emit('circuitEstablished');
    }
  });

  router.on('circuitEstablished', () => {
    router.logger('circuit established');

    // now possibly process buffered requests?
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
//  port: what we listen for router connections on 
//  routerListener: TCP server connection which receives initiations from
//    other routers
//  instanceNum: the instanceNum of this router
//  groupID: the id of our group, common to all of our routers
//  id: (groupID << 16) || instanceNum
//  openConns: map from routerIDs to TCPRouterConnections
//  ingressProxy: IngressHTTPProxy
//  egressProxy: EgressHTTPProxy
//  circuitMap: [inCircuitID, routerID] -> outCircuitID
//  circuitCount: count of circuits we've seen so far
//  circuitID: the circuit id this starts with
//  circuitIDToRouterID: outCircuitID -> routerID 
//  circuitLength: the current length of the circuit starting at this router
function Router(port, groupID, instanceNum) {
  this.agent = new registration.registrationAgent(port + 1, this); // where did this port come from?
  this.port = port;
  this.groupID = groupID;
  this.instanceNum = instanceNum;
  this.availableRouters = null;
  this.circuitLength = 0; // The circuit is currently just this router
  this.circuitCount = 1; // Every circuit starts with the id of 1.
  this.id = (this.groupID << 16) || this.instanceNum;

  // Initialize openConns, a map of all open TCP connections to this router
  this.openConns = new Map();
  // Initialize circuitMap, a map of ingoing to outgoing circuit numbers
  this.circuitMap = new Map();
  // Initialize circuitIDToRouterID, a map from circuit number to 
  this.circuitIDToRouterID = new Map();

  // STEP 0: bind a socket to listen on port
  this.routerListener = new connections.routerListener(this, port);
  // STEP 1: Register self using agent
  this.agent.sendCommand("r " + this.port + " " + this.id + " " +  "Tor61Router-" + groupID + "-" + instanceNum);

  this.logger = (data) => {
    if (LOGGING) {
      console.log("Tor61Router " + this.id + ": " + data);
    }
  }
}

// established a circuit from router given a list of availableRouters to use in
// the circuit.
function createCircuit(router, tries) {
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
      // try to create the next hop
      conn.tryCreate(router.circuitCount, 0);
      router.ciruitCount++;
    } else {
      var socket = new net.createConnection(destRouter.get("port"),
        destRouter.get("IP"));

      socket.on('connect', () => {
        router.logger("connected to first part of circuit!");
        var conn = new connections.TCPRouterConnection(router, socket,
          destRouter.get("data"));
        // try to create the next hop
        conn.tryCreate(router.circuitCount++, 0);
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

util.inherits(Router, events.EventEmitter);
