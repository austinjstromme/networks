// this file contains the main router logic for the Tor61 node

var net = require('net');
var cells = require('./cells');








// A router object will contain
//  agent: an Agent to handle registration
//  port: what we listen for router connections on 
//  routerListener: TCP server connection which receives initiations from
//    other routers
//  id: the id of this router
//  openConns: map from routerIDs to TCPRouterConnections
//  ingressProxy: IngressHTTPProxy
//  egressProxy: EgressHTTPProxy
//  circuitMap: inCircuitID -> outCircuitID
//  circuitID: the circuit id this starts with
//  circuitToRouterID: outCircuitID -> routerID

// returns a fresh router binded to this port
exports.createRouter = function (port, groupid, instanceNum) {
  // STEP 0: bind a socket to listen on port

  // STEP 1: Register self using agent

  // STEP 2: Initialize openConns

  // STEP 3: 
}
