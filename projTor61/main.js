var registration = require("../proj1/client.js");
var router = require("./router.js");
var events = require('events');

// port to bind this to
const PORT = process.argv[2];

// group id
const GROUPID = 1035;

//r2 = router.makeRouter(PORT + 10, GROUPID, 0001);
r1 = router.makeRouter(PORT, GROUPID, 0001);
