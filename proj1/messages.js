//

//
exports.processMessage = function(message) {
  var pMessage = {};
  pMessage["valid"] = false;

  if (message[0] != 0xC4 || message[1] != 0x61) { //I think this checks the magic number?
    // invalid
    return pMessage;
  }

  pMessage["valid"] = true;

  pMessage["command"] = message[2];

};

//
exports.sendRegister = function(socket, clientPort,
  clientAddress, seqNum, serviceIP, servicePort, 
  serviceData, serviceName) {

  var message = Buffer.allocUnsafe(15 + serviceName.length);
  message.writeUInt16BE(50273, 0);
  message.writeUInt8(seqNum, 2);
  message.writeUInt8(1, 3); //register
  message.writeUInt32BE(serviceIP, 4); //service IP
  message.writeUInt16BE(servicePort, 8); //service port
  message.writeUInt32BE(serviceData, 10); //service data
  message.writeUInt8(serviceName.length, 14); //service name len

  //write out the serviceName on the end
  message.write(serviceName.toString('ascii'), 15);

  // send the message over socket
  socket.send(message, 0, message.length, clientPort,
    clientAddress, function (err, bytes) {
    if (err) {
      throw err;
    }
  });
};

//
exports.sendUnregister = function(socket, clientPort,
  clientAddress, seqNum, serviceIP, servicePort) {

  var message = Buffer.allocUnsafe(10);
  message.writeUInt16BE(50273, 0);
  message.writeUInt8(seqNum, 2);
  message.writeUInt8(5, 3); //unregister
  message.writeUInt32BE(serviceIP, 4);//serviceIP
  message.writeUInt16BE(servicePort, 8)//servicePort

  // send the message over socket
  socket.send(message, 0, message.length, clientPort,
    clientAddress, function (err, bytes) {
    if (err) {
      throw err;
    }
  });
};

//
exports.sendFetch = function(socket, clientPort,
  clientAddress, seqNum, serviceName) {

  var message = Buffer.allocUnsafe(5 + serviceName.length);
  message.writeUInt16BE(50273, 0);
  message.writeUInt8(seqNum, 2);
  message.writeUInt8(3, 3); // Fetch
  message.writeUInt8(serviceName.length, 4);

  //write out the serviceName on the end
  message.write(serviceName.toString('ascii'), 5);

  // send the message over socket
  socket.send(message, 0, message.length, clientPort,
    clientAddress, function (err, bytes) {
    if (err) {
      throw err;
    }
  });
};

//
exports.sendProbe = function(socket, clientPort,
  clientAddress, seqNum) {

  var message = Buffer.allocUnsafe(4);
  message.writeUInt16BE(50273, 0);
  message.writeUInt8(seqNum, 2);
  message.writeUInt8(6, 3); //Probe

  // send the message over socket
  socket.send(message, 0, message.length, clientPort,
    clientAddress, function (err, bytes) {
    if (err) {
      throw err;
    }
  });
};

//
exports.sendACK = function(socket, clientPort,
  clientAddress, seqNum) {

  var message = Buffer.allocUnsafe(4);
  message.writeUInt16BE(50273, 0);
  message.writeUInt8(seqNum, 2);
  message.writeUInt8(7, 3); //ACK

  // send the message over socket
  socket.send(message, 0, message.length, clientPort,
    clientAddress, function (err, bytes) {
    if (err) {
      throw err;
    }
  });
};