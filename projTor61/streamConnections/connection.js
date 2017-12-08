var events = require('events');

function getHeader(string) {
  for (var i = 0; i < string.length - 3; i++) {
    substr  = string.substr(i, 4);
    if (substr == '\r\n\r\n') {
      return string.substr(0, i + 4);
    }
  }
  return null;
}

function replaceSubstr(base, excise_start, excise_finish, replacement) {
  var l = substr.length
  return (base.substr(0, excise_start) + replacement
    + base.substr(excise_finish, base.length - excise_finish));
}

function processHeader(header) {
  // define splitting criteria - spaces, new lines, carriage returns, semicolons
  var regex = /[\s\r\n]+/;
  tokens = header.split(regex);
  var pHeader = {}
  pHeader["type"] = tokens[0];
  pHeader["port"] = null;

  pHeader["encoding"] = 'binary';

  var loc = 0;
  for (var tokenInd = 0; tokenInd < tokens.length; tokenInd++) {
    // increment loc until it's pointing to the start of the current token
    while ((header.substr(loc, tokens[tokenInd].length) != tokens[tokenInd])
        && (loc < header.length)) {
      loc++;
    }

    if (tokens[tokenInd] == "HTTP/1.1") {
      // fix
      header = replaceSubstr(header, loc, loc + tokens[tokenInd].length, "HTTP/1.0");
    } else if (tokenInd > 0 && tokens[tokenInd - 1].toLowerCase() == "host:") {
      pHeader["host"] = tokens[tokenInd];
      regex = /:+/;
      portTokens = tokens[tokenInd].split(regex);
      if (portTokens.length == 2) {
        pHeader["port"] = portTokens[1];
        pHeader["host"] = portTokens[0];
      } else if (portTokens.length == 6) {
        pHeader["port"] = portTokens[5];
        pHeader["host"] = (portTokens.splice(-1, 1)).join();
      }

      if (isNaN(pHeader["port"]) || pHeader["port"] < 0 || pHeader["port"] >= 65536) {
        pHeader["port"] = null;
      }
    } else if (tokenInd > 0 && tokens[tokenInd - 1].toLowerCase() == "connection:") {
      // fix
      header = replaceSubstr(header, loc, loc + tokens[tokenInd].length, "close");
    }
    // increment loc as necessary
    loc += tokens[tokenInd].length;
  }

  if (pHeader["port"] == null) {
    portTokens = tokens[1].split(/:+/);
    if (portTokens[0] == 'https') {
      pHeader["port"] = 443;
    } else {
      pHeader["port"] = 80;
    }
  }

  pHeader["fullHeader"] = header;

  return pHeader;
}

exports.clientConnection = function (proxy, inStream, socket) {
  this.proxy = proxy;
  this.inStream = inStream;
  this.socket = socket;
  this.header = null; // the full header, unaugmented
  this.pHeader = null; // the processed header object, contains augmented header
  this.headerBuf = null;
  this.sendBuf = null;
  this.serverConn = null;
  this.dataEncoding = 'binary';
  events.EventEmitter.call(this);

  socket.on('data', (buf) => {
    var data_utf = buf.toString();
    var data_bin = buf.toString(this.dataEncoding);
    if (this.header == null) {
      // haven't yet received full header, so append onto buffer
      if (this.headerBuf == null) {
        this.headerBuf = data_utf;
      } else {
        this.headerBuf += data_utf;
      }
      // check if it's a complete header:
      this.header = getHeader(this.headerBuf);
      if (this.header != null) {
        // it's a complete header - process the message and handle the request
        this.pHeader = processHeader(this.header);
        this.dataEncoding = this.pHeader["encoding"];
        var body_start = (this.header.length
          - (this.headerBuf.length - data_utf.length));
        this.sendBuf = data_bin.substr(body_start, data_bin.length - body_start);
        if (this.sendBuf.length == 0) {
          this.sendBuf == null;
        }
        this.proxy.emit('clientHeader', this);
      }
    } else {
      if (this.sendBuf != null) {
        this.sendBuf += data_bin;
      } else {
        // already sent off the header, everything is now body:
        this.proxy.emit('clientBody', this, data_bin);
      }
    }
  });

  socket.on('close', () => {
    if (this.serverConn != null && !this.serverConn.socket.destroyed) {
      this.serverConn.socket.destroy();
    }
  });
}

exports.serverConnection = function (proxy, socket, clientConn) {
  this.proxy = proxy;
  this.socket = socket;
  this.header = null;
  this.headerBuf = null;
  this.pHeader = null;
  this.clientConn = clientConn;
  this.dataEncoding = 'ascii';

  events.EventEmitter.call(this);

  socket.on('data', (buf) => {
    var data_utf = buf.toString();
    var data_bin = buf.toString(this.dataEncoding);
    if (this.clientConn.pHeader["type"] == "CONNECT") {
      // simply forward it on
      this.proxy.emit('serverBody', this, data_bin);
      return;
    }
    if (this.header == null) {
      // haven't yet received full header, so append onto buffer
      if (this.headerBuf == null) {
        this.headerBuf = data_utf;
      } else {
        this.headerBuf += data_utf;
      }
      this.header = getHeader(this.headerBuf);
      if (this.header != null) {
        // it's a complete header - process the message and handle the request
        this.pHeader = processHeader(this.header);
        this.dataEncoding = this.pHeader["encoding"];
        this.proxy.emit('serverHeader', this);
        // forward any part of the body we've already received
        var body_start = (this.header.length
          - (this.headerBuf.length - data_utf.length));
        var body = data_bin.substr(body_start, data_bin.length - body_start);
        if (body.length != 0) {
          this.proxy.emit('serverBody', this, body);
        }
      }
    } else {
      // already sent off the header, everything is now body:
      this.proxy.emit('serverBody', this, data_bin);
    }
  });

  socket.on('close', () => {
    if (!this.clientConn.socket.destroyed) {
      this.clientConn.socket.destroy();
    }
  });
}
