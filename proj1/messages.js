// Basic messages to be used in registration protocol.

// process any message of type Registered, FetchResponse, probe, or ACK.
// returned result will depend on what message is receivec.
exports.processMessage = function(message) {
  var pMessage = {};
  pMessage["valid"] = false;

  if (message[0] != 0xC4 || message[1] != 0x61) {
    // invalid
    return pMessage;
  }

  pMessage["valid"] = true;
  pMessage["seqNum"] = message[2];
  pMessage["command"] = message[3];

  if (pMessage["command"] == 2) { //Registered message

  	//we want bytes 4 and 5 here but the lifetime currently fits just in byte 5
  	pMessage["lifetime"] = message.readUInt16BE(4);

  } else if (pMessage["command"] == 4) { //FetchResponse
  	pMessage["numEntries"] = message[4];
  	pMessage["entries"] = []; //list to hold all returned nodes
  	
  	for (var i = 0; i < pMessage["numEntries"]; i = i+10){

  	  var entries = new Map();
  	  entries.set("IP", message.readUInt32BE(5+i*10)); //4 bytes
  	  entries.set("port", message.readUInt16BE(9+i*10)); //2 bytes
  	  entries.set("data", message.readUInt32BE(11+i*10)); //4 bytes

  	  pMessage["entries"].push(entries); 
  	}
  	
  }

  return pMessage;
};

// send a register message 
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

// send an unregister message to unregister the servicePort
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

// send a fetch message to get all registered nodes with serviceName as a prefix
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

// send a probe message
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

// send an ACK message
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