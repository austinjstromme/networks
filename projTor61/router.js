// this file contains the main router logic for the Tor61 node

var net = require('net');
var events = require('events');
var cells = require('./cells');
var connections = require('./connections');
var registration = require("../proj1/client.js");


// returns a fresh router binded to this port

exports.router = function (port, groupid, instanceNum) {

  var router = new initializeRouter(port, groupid, instanceNum);

  router.on("open", () => {
    console.log("opened");
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
//  circuitToRouterID: outCircuitID -> routerID

function initializeRouter(port, groupid, instanceNum){

  this.agent = new registration.registrationAgent(32733);
  this.port = port;
  this.groupid = groupid;
  this.id = instanceNum;

  // STEP 0: bind a socket to listen on port
  this.routerListener = new connections.routerListener(this, port);

  // STEP 1: Register self using agent
  this.agent.sendCommand("r " + this.port + "data" +  "Tor61Router-" + groupid + "-" + instanceNum + "\n");

  // STEP 2: Initialize openConns, a map of all open TCP connections to this router
  this.openConns = new Map();

  // STEP 3: establish ciruit

  events.EventEmitter.call(this);
}