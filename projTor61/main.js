// port to bind this to
const PORT = process.argv[2];
// group id
const GROUPID = 1035;

var router = require('./router');

router.createRouter(PORT, GROUPID);
