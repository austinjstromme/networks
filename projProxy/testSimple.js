var net = require('net');

var ADDRESS = 'attu3.cs.washington.edu'
var PORT = 3335;

var proxySocket = net.createConnection(PORT, ADDRESS);
var proxyResponse = '';
var proxyHeader = 0;

var msg = ('GET http://www.dictionary.com/browse/test HTTP/1.1\r\nHost: www.dictionary.com\r\n'
        + 'User-Agent: Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:56.0) Gecko/20100101 Firefox/56.0\r\n'
        + 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n'
        + 'Accept-Language: en-US,en;q=0.5\r\n'
        + 'Accept-Encoding: gzip, deflate\r\n'
        + 'Referer: https://us.search.yahoo.com/\r\n'
        + 'Cookie: mseg=30\r\n'
        + 'Connection: close\r\n'
        + 'Upgrade-Insecure-Requests: 1\r\n'
        + 'Cache-Control: max-age=0\r\n\r\n');

proxySocket.write(msg);

proxySocket.on('data', (buf) => {
  //proxyResponse += buf;

  if (proxyHeader < 2) {
    //console.log("proxy>>>" + buf.toString().substr(0, 1000));
    proxyResponse += buf.toString().substr(0, msg.length);
    proxyHeader++;
  }
});

var cnnSocket = net.createConnection(80, 'dictionary.com');
var cnnResponse = '';
var cnnHeader = 0;

cnnSocket.write(msg);

cnnSocket.on('data', (buf) => {
  //cnnResponse += buf;

  if (cnnHeader < 1) {
    //console.log("correct>>>" + buf.toString().substr(0, 1000));
    cnnResponse += buf.toString().substr(0, msg.length);
    cnnHeader++;
  }
});

setTimeout(checkResponses, 10000);

function checkResponses() {
  console.log("correct>>>" + cnnResponse);
  console.log("proxy>>>" + proxyResponse);
  //if (cnnResponse.length != proxyResponse.length) {
//    console.log("cnnResponse.length == " + cnnResponse.length);
//    console.log("while proxyResponse.length == " + proxyResponse.length);
//    return;
//  }
//
//  for (var i = 0; i < cnnResponse.length; i++) {
//    if (cnnResponse[i] != proxyResponse[i]) {
//      console.log("they differ at coordinate i == " + i);
//      console.log("near here, cnn = " + cnnResponse.substr(i - 5, 20));
//      console.log("while proxy = " + proxyResponse.substr(i - 5, 20));
//    }
//  }
}
