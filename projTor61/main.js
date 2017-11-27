var registration = require("../proj1/client.js");
var router = require("./router.js");
var events = require('events');

// port to bind this to
const PORT = process.argv[2];

// group id
const GROUPID = 1035;

agent = new registration.registrationAgent(32963);

//agent.sendCommand("p");
//agent.sendCommand("r 12345 3344 Agent6");
//agent.sendCommand("r 12346 3344 Agent7");
//agent.sendCommand("r 12347 3344 Agent8");
//agent.sendCommand("f A"); // I guess we should listen for a message and then process it? Talk on Monday

r1 = router.makeRouter(PORT, GROUPID, 0000);
