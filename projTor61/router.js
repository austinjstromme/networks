// this file contains the main router logic for the Tor61 node

var net = require('net');
var events = require('events');
var util = require('util');
var cells = require('./cells');
var connections = require('./connections');
var registration = require("../proj1/client.js");

const TIMEOUT = 3000; // timeout in ms
const MAX_TRIES = 3; // max tries

// returns a fresh router binded to this port
// this is where all of the logic of the router is 
exports.makeRouter = function (port, groupid, instanceNum) {

  // first create a router object
  var router = new Router(port, groupid, instanceNum);

  router.on('fetchResponse', (fetchResult) => {
    // router.availableRouters = fetchResult;
    // create circuit with fetchResult
    createCircuit(router, fetchResult);
  });

  // ona created message we need to send a relay extend
  router.on('created', () => {
    router.circuitLength++;
    console.log("created")
  });

  // Failed to create a TCP connection, remove the bad router from availible routers and try again
  router.on('createFailed', (TCPRouterConnection) => {
    console.log("failed to create a TCP connection with " + TCPRouterConnection.destRouterID);
    // probably want to kick off the create again with another fetch?
    // router.agent.sendCommand("f Tor61Router-" + groupid + "-" + instanceNum);
  });

  return router;
}

// A router object will contain
//  agent: an Agent to handle registration
//  port: what we listen for router connections on 
//  routerListener: TCP server connection which receives initiations from
//    other routers
//  id: the id of this router
//  groupid: the id of our group, common to all of our routers
//  openConns: map from routerIDs to TCPRouterConnections
//  ingressProxy: IngressHTTPProxy
//  egressProxy: EgressHTTPProxy
//  circuitMap: inCircuitID -> outCircuitID
//  circuitID: the circuit id this starts with
//  circuitToRouterID: outCircuitID -> TCPRouterConnection 
//  circuitLength: the current length of the circuit starting at this router
function Router(port, groupid, instanceNum) {
  this.agent = new registration.registrationAgent(32733, this); // where did this port come from?
  this.port = port;
  this.groupid = groupid;
  this.id = instanceNum;
  // this.availableRouters = [];
  this.circuitLength = 1; // The circuit is currently just this router
  this.circuitID = 1; // Every circuit starts with the id of 1.

  // Initialize openConns, a map of all open TCP connections to this router
  this.openConns = new Map();
  // Initialize circuitMap, a map of ingoing to outgoing circuit numbers
  this.circuitMap = new Map();
  // Initialize circuitToRouterID, a map from circuit number to 
  this.circuitToRouterID = new Map();

  // STEP 0: bind a socket to listen on port
  this.routerListener = new connections.routerListener(this, port);
  // STEP 1: Register self using agent
  this.agent.sendCommand("r " + this.port + " " + this.id + " " +  "Tor61Router-" + groupid + "-" + instanceNum);
  // STEP 2: issue fetch request, this kicks off the createCircuit function
  this.agent.sendCommand("f Tor61Router-" + groupid + "-" + instanceNum);
}

// established a circuit from router given a list of availableRouters to use in the circuit.
function createCircuit(router, availableRouters, desiredLength) {
  while(router.circuitLength < desiredLength){
    // choose a randomly available router as the next hop in our circuit
    destRouter = availableRouters[Math.floor(Math.random()*availableRouters.length)];

    //open a TCP connection with that router, if one doesn't already exist
    if router.openConns.has(destRouter.get("data")){
      var conn = router.openConns.get(destRouter.get("data"));
    } else {
      var conn = new connections.TCPRouterConnection(router);
    }
    
    //try to create the next hop
    conn.tryCreate(findCircuitID(router, destRouter), 0);
  }
}

//extend the circuit starting at router by one hop
function extendOneHop(sourceRouter, ){
  // send a relay extend along the circuit
}

// returns the first unused circuitID for router
function findCircuitID(sourceRouter, destRouter) {
  circID = 2;
  while (true) {
    if (sourceRouter.circuitMap.values().includes(circID) || destRouter.circuitMap.keys().includes(circID)) { // make sure these values are ints and not strings
      circID++;
    } else {
      break;
    }
  }
  return circID;
}

util.inherits(Router, events.EventEmitter);