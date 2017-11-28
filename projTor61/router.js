// this file contains the main router logic for the Tor61 node

var net = require('net');
var events = require('events');
var util = require('util');
var cells = require('./cells');
//var connections = require('./connections');
var registration = require("../proj1/client.js");

// returns a fresh router binded to this port
// this is where all of the logic of the router is 
exports.makeRouter = function (port, groupid, instanceNum) {

  // first create a router object
  var router = new Router(port, groupid, instanceNum);

  router.on('fetchResponse', (fetchResult) => {
    // create circuit with fetchResult:
    createCircuit(router, fetchResult);
  });

  // router.on('create', () => console.log("created"));

  // router.on('destroy', () => console.log("destoryed"));

  // router.on('relay', () => console.log("relayed?"));

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
//  circuitToRouterID: outCircuitID -> routerID
function Router(port, groupid, instanceNum) {
  this.agent = new registration.registrationAgent(32733, this);
  this.port = port;
  this.groupid = groupid;
  this.id = instanceNum;

  // Initialize openConns, a map of all open TCP connections to this router
  this.openConns = new Map();

  this.circuitMap = new Map();

  // STEP 0: bind a socket to listen on port
  //this.routerListener = new connections.routerListener(this, port);

  // STEP 1: Register self using agent
  this.agent.sendCommand("r " + this.port + " 16981 " +  "Tor61Router-" + groupid + "-" + instanceNum);

  // STEP 2: issue fetch request
  this.agent.sendCommand("f Tor61Router-" + groupid + "-" + instanceNum);
  //this.agent.sendCommand("f");
}

function startCircuit(router) {
  // STEP 0: select a router from availableRouters

  // STEP 1: open TCPRouterConnection with it or use an already existing one
  //var conn = new connections.TCPRouterConnection(router, socket, destRouterID);

  // STEP 2: send create to first router
  //conn.tryCreate(router.circuitID, 0);
}

util.inherits(Router, events.EventEmitter);
