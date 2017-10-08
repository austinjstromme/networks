// process the message
exports.processMessage = function(message) {
  var pMessage = {};
  pMessage["valid"] = false;

  if (message.length < 12 || message[0] != 0xC4 || message[1] != 0x61
    || message[2] != 0x1) {
    // invalid
    return pMessage;
  }

  pMessage["valid"] = true;

  pMessage["command"] = message[3];
  pMessage["seqNum"] = message.readUInt32BE(4);
  pMessage["sesID"] = message.readUInt32BE(8);

  var iter = message.values();

  for (var i = 0; i < 12; i++) {
    iter.next();
  }

  pMessage["data"] = iter;

  return pMessage;
}
