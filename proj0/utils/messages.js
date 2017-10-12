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

  var data = "";

  if (pMessage["command"] == 0x1) {
    data = message.toString("ascii", 12);
  }

  pMessage["data"] = data;

  return pMessage;
}

exports.sendMessage = function(socket, clientPort,
  clientAddress, seqNum, sesID, type, data) {

  var datalen;
  if (!data) {
    datalen = 0;
  } else {
    datalen = data.length;
  }

  var message = Buffer.allocUnsafe(12 + datalen);

  // write out the header
  message.writeUInt16BE(50273, 0);
  message.writeUInt8(1, 2);
  message.writeUInt8(type, 3);
  message.writeUInt32BE(seqNum, 4);
  message.writeUInt32BE(sesID, 8);

  // write out the data if necessary
  if (datalen > 0) {
    message.write(data.toString('ascii'), 12);
  }

  // send the message over socket
  socket.send(message, 0, message.length, clientPort,
    clientAddress, function (err, bytes) {
      if (err) {
        throw err;
      }
    });
  }

