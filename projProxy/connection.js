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

  var tokenInd = 1; // first token is message type
  var loc = 0;
  for (var tokenInd = 1; tokenInd < tokens.length; tokenInd++) {
    // increment loc until it's pointing to the start of the current token
    while ((header.substr(loc, tokens[tokenInd].length) != tokens[tokenInd])
        && (loc < header.length)) {
      loc++;
    }

    if (tokens[tokenInd] == "HTTP/1.1") {
      // fix
      header = replaceSubstr(header, loc, loc + tokens[tokenInd].length, "HTTP/1.0");
    } else if (tokens[tokenInd - 1].toLowerCase() == "host:") {
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
    } else if (tokens[tokenInd - 1].toLowerCase() == "connection:") {
      // fix
      header = replaceSubstr(header, loc, loc + tokens[tokenInd].length, "close");
    }
    // increment loc as necessary
    loc += tokens[tokenInd].length;
  }

  if (pHeader["port"] == null) {
    portTokens = tokens[1].split(/:+/);
    if (portTokens.length == 1) {
      pHeader["port"] = 80;
    } else if (portTokens.length == 2) {
      if (portTokens[0].toLowerCase() == 'https') {
        pHeader["port"] = 443;
      } else {
        pHeader["port"] = 80;
      }
    } else {
      // plus herE?
      pHeader["port"] = +portTokens[2].split('/')[0];
    }
  }

  //console.log("find port = " + pHeader["port"]);
  //console.log("and host = " + pHeader["host"]);
  pHeader["fullHeader"] = header;

  return pHeader;
}

exports.clientConnection = function (proxy, socket) {
  this.proxy = proxy;
  this.socket = socket;
  this.header = null; // the full header, unaugmented
  this.pHeader = null; // the processed header object, contains augmented header
  this.headerBuf = null;
  this.sendBuf = null;
  this.serverConn = null;
  this.encoding = 'utf8';
  events.EventEmitter.call(this);

  socket.on('data', (buf) => {
    if (this.header == null) {
      // haven't yet received full header, so append onto buffer
      if (this.headerBuf == null) {
        this.headerBuf = buf.toString(this.encoding);
      } else {
        this.headerBuf += buf.toString(this.encoding);
      }
      // check if it's a complete header:
      this.header = getHeader(this.headerBuf);
      if (this.header != null) {
        // it's a complete header - process the message and handle the request
        this.pHeader = processHeader(this.header);
        console.log("processed client header = " + this.pHeader["fullHeader"]);
        this.proxy.emit('clientHeader', this);
        body = buf.toString(this.encoding).substr(this.header.length, this.headerBuf.length
                                                          - this.header.length);
        this.sendBuf = body;
      }
    } else {
      if (this.sendBuf != null) {
        this.sendBuf += buf.toString(this.encoding);
      } else {
        // already sent off the header, everything is now body:
        this.proxy.emit('clientBody', this, buf.toString(this.encoding));
      }
    }
  });

  socket.on('close', () => {
    console.log("client socket closing -- need to do something!!");
  });
}

exports.serverConnection = function (proxy, socket, clientConn) {
  this.proxy = proxy;
  this.socket = socket;
  this.sendBuf = null;
  this.header = null;
  this.headerBuf = null;
  this.pHeader = null;
  this.clientConn = clientConn;
  this.encoding = 'utf8';

  events.EventEmitter.call(this);

  socket.on('data', (buf) => {
    if (this.clientConn.pHeader["type"] == "CONNECT") {
      // simply forward it on
      this.proxy.emit('serverBody', this, buf.toString(this.encoding));
    }
    if (this.header == null) {
      // haven't yet received full header, so append onto buffer
      if (this.headerBuf == null) {
        this.headerBuf = buf.toString(this.encoding);
      } else {
        this.headerBuf += buf.toString(this.encoding);
      }
      // check if it's a complete header:
      //console.log("server header = " + this.headerBuf);
      this.header = getHeader(this.headerBuf);
      if (this.header != null) {
        // it's a complete header - process the message and handle the request
        this.pHeader = processHeader(this.header);
        console.log("processed server header = " + this.pHeader["fullHeader"]);
        this.proxy.emit('serverHeader', this);
        // forward any part of the body we've already received
        body = buf.toString(this.encoding).substr(this.header.length, this.headerBuf.length
                                                          - this.header.length);
        this.proxy.emit('serverBody', this, body);
      }
    } else {
      // already sent off the header, everything is now body:
      this.proxy.emit('serverBody', this, buf.toString(this.encoding));
    }
  });

  socket.on('close', () => {
    console.log("server socket closing -- need to do something!!");
  });
}

