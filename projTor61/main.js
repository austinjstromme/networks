var registration = require("../proj1/client.js");
var router = require("./router.js");
var events = require('events');

// port to bind this to
const PORT = parseInt(process.argv[2]);

// group id
const GROUPID = 1035;


r1 = router.makeRouter(PORT, GROUPID, 0001);
r2 = router.makeRouter(PORT + 100, GROUPID, 0011);
r3 = router.makeRouter(PORT + 200, GROUPID, 0111);