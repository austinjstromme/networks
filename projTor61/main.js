var registration = require("../proj1/client.js");
var router = require("./router.js");
var events = require('events');

// port to bind this to
const PORT = parseInt(process.argv[2]);
const instanceNum = parseInt(process.argv[3]);

// group id
const GROUPID = 1035;

r1 = router.makeRouter(PORT, GROUPID, instanceNum);
