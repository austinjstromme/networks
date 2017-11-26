var registration = require("../proj1/client.js");
var router = require("./router.js");

// port to bind this to
const PORT = process.argv[2];

// group id
const GROUPID = 1035;

//var router = require('./router');

//router.createRouter(PORT, GROUPID);

agent = new registration.registrationAgent(32963);

agent.sendCommand("p");
agent.sendCommand("r 12345 3344 Agent6");
agent.sendCommand("r 12346 3344 Agent7");
agent.sendCommand("r 12347 3344 Agent8");
agent.sendCommand("f A");

//agent.sendCommand("u 12345");

//r1 = router.router(PORT, GROUPID, 0000);

//r1.emit('open');