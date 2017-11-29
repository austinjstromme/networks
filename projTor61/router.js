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
    // create circuit with fetchResult
    createCircuit(router, fetchResult);
  });

  // router.on('create', () => console.log("created"));

  // router.on('destroy', () => console.log("destoryed"));

  // router.on('relay', () => console.log("relayed?"));

  //failed to create a TCP connection, remove the bad router from availible routers and try again
  router.on('createFailed', (TCPconn) => {
    console.log("failed to create a TCP connection with " + TCPconn.destRouterID);

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
//  circuitToRouterID: outCircuitID -> TCPRouterConnection //Should this be a map to port num?
function Router(port, groupid, instanceNum) {
  this.agent = new registration.registrationAgent(32733, this);
  this.port = port;
  this.groupid = groupid;
  this.id = instanceNum;

  // Initialize openConns, a map of all open TCP connections to this router
  this.openConns = new Map();

  // Initialize circuitMap, a map of ingoing to outgoing circuit numbers
  this.circuitMap = new Map();

  // Initialize circuitToRouterID, a map from circuit number to 
  this.circuitToRouterID = new Map();

  // Every circuit starts with the id of 1.
  this circuitID = 1;

  // STEP 0: bind a socket to listen on port
  this.routerListener = new connections.routerListener(this, port);

  // STEP 1: Register self using agent
  this.agent.sendCommand("r " + this.port + " 16981 " +  "Tor61Router-" + groupid + "-" + instanceNum);

  // STEP 2: issue fetch request, this kicks off the createCircuit function
  this.agent.sendCommand("f Tor61Router-" + groupid + "-" + instanceNum);
}

// established a circuit from router given a list of availableRouters to use in the circuit.
function createCircuit(router, availableRouters) {
  // STEP 0: select two routers from availableRouters

  // each element of availableRouters is a dict with the keys 'IP', 'port', 'data'
  second_node = availableRouters[Math.floor(Math.random()*availableRouters.length)];
  third_node = availableRouters[Math.floor(Math.random()*availableRouters.length)];

  // STEP 1: open TCPRouterConnection with it or use an already existing one
  var conn = new connections.TCPRouterConnection(router, socket, destRouterID);
  conn.tryCreate(findCircuitID(router));

  // STEP 2: send create to first router
  //conn.tryCreate(router.circuitID, 0);
}

// returns the first unused circuitID for router
function findCircuitID(router) {
  circID = 2;
  while (true) {
    if (router.circuitMap.values().includes(circID)) { // make sure these values are ints and not strings
      circID++;
    } else {
      break;
    }
  }
  return circID;
}

util.inherits(Router, events.EventEmitter);