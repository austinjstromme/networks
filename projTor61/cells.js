// this file contains the low-level parsing and writing code for cells

// cell should be a string written from a buffer using the ascii encoding
//
// Parses the cell and returns its contents, an object with the following
//  attributes:
//    valid: boolean; true if this is a valid tor61 cell
//    circuitID: 2 byte unsigned int;
//    cmd: 1 byte unsigned int; between 1 and 8 inclusive
//
// Additionally, if the cmd is 0x05 (open), 0x06 (opened), 0x07 (open failed)
//  it also has the following attributes:
//    openerID: 4 byte unsigned int;
//    openedID: 4 byte unsigned int;
//
// If the cmd is 0x03 (relay) it also has the following attributes:
//    relayCmd: 1 byte unsigned int; the type of relay message
//    streamID: 2 byte unsigned int;
//    body: string; no zero padding, possibly empty
exports.parseCell = function (cell) {
  var contents = {};

  var bufCell = Buffer.from(cell, 'ascii');

  contents["valid"] = false;
  if (cell.length != 512) {
    return contents;
  }

  contents["circuitID"] = bufCell.readUInt16BE(0);
  contents["cmd"] = bufCell.readUInt8(2);

  if (contents["cmd"] == 0x01 || contents["cmd"] == 0x02
    || contents["cmd"] == 0x03 || contents["cmd"] == 0x04) {
    contents["valid"] = true;
    return contents;
  }

  if (contents["cmd"] == 0x05 || contents["cmd"] == 0x06
    || contents["cmd"] == 0x07) {
    contents["openerID"] = bufCell.readUInt32BE(3);
    contents["openedID"] = bufCell.readUInt32BE(7);
    contents["valid"] = true;
    return contents;
  }

  if (contents["cmd"] == 0x03) {
    contents["streamID"] = bufCell.readUInt16BE(3);
    contents["relayCmd"] = bufCell.readUInt8(13);
    var bodyLength = bufCell.readUInt16BE(11);
    contents["body"] = bufCell.toString('ascii', 14, 14 + bodyLength);
    contents["valid"] = true;
    return contents;
  }

  // if here, then it's invalid, so return
  return contents;
}

// returns an open cell using an ascii encoding
exports.createOpenCell = function (openerID, openedID) {
  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt8(0x05, 2);
  buf.writeUInt32BE(openerID, 3);
  buf.writeUInt32BE(openedID, 7);

  return buf.toString('ascii');
}

// returns an opened cell using an ascii encoding
exports.createOpenedCell = function (openerID, openedID) {
  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt8(0x06, 2);
  buf.writeUInt32BE(openerID, 3);
  buf.writeUInt32BE(openedID, 7);

  return buf.toString('ascii');
}

// returns an open failed cell using an ascii encoding
exports.createOpenFailedCell = function (openerID, openedID) {
  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt8(0x07, 2);
  buf.writeUInt32BE(openerID, 3);
  buf.writeUInt32BE(openedID, 7);

  return buf.toString('ascii');
}

// returns a create cell using an ascii encoding
exports.createCreateCell = function (circuitID) {
  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt16BE(circuitID, 0);
  buf.writeUInt8(0x01, 2);

  return buf.toString('ascii');
}

// returns a created cell using an ascii encoding
exports.createCreatedCell = function (circuitID) {
  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt16BE(circuitID, 0);
  buf.writeUInt8(0x02, 2);

  return buf.toString('ascii');
}

// returns a create failed cell using an ascii encoding
exports.createCreateFailedCell = function (circuitID) {
  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt16BE(circuitID, 0);
  buf.writeUInt8(0x03, 2);

  return buf.toString('ascii');
}

// returns a destory cell using an ascii encoding
exports.createDestroyCell = function (circuitID) {
  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt16BE(circuitID, 0);
  buf.writeUInt8(0x04, 2);

  return buf.toString('ascii');
}

// returns a relay cell using an ascii encoding
exports.createRelayCell = function (circuitID, streamID, relayCmd, body) {
  if ((body.length + 14) > 512) {
    console.log("malformed body to createRelayCell!");
  }

  // starts 0-initialized
  var buf = Buffer.alloc(512);

  buf.writeUInt16BE(circuitID, 0);
  buf.writeUInt8(0x03, 2);
  buf.writeUInt16BE(streamID, 3);
  buf.writeUInt16BE(body.length, 11);
  buf.writeUInt8(relayCmd, 13);
  buf.write(body, 'ascii', 14);

  return buf.toString('ascii');
}
