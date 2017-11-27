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

exports.createCell = function(contents) {
  /// create the cell using the contents
  
}
