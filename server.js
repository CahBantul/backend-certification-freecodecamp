   
require('dotenv').config();
// server.js
// where your node app starts

// init project
var express = require('express');
const mongodb = require('mongodb');
const mongoose = require('mongoose');
var app = express();
const port = process.env.PORT || 3000;

mongoose.connect(process.env.DB_URI);

// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC
var cors = require('cors');
app.use(cors({ optionsSuccessStatus: 200 })); // some legacy browsers choke on 204

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// check isUnix
const isUnix = (date) => {
  return /^\d+$/.test(date);
};

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/timestamp', (req, res) => {
  res.sendFile(__dirname + '/views/timestamp.html');
});

app.get('/request-header-parser', (req, res) => {
  res.sendFile(__dirname + '/views/requestHeaderParser.html');
});
app.get('/url-shortener', (req, res) => {
  res.sendFile(__dirname + '/views/urlShortener.html');
});

// request Header Parser
app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.connection.remoteAddress,
    language: req.headers['accept-language'],
    software: req.headers['user-agent'],
  });
});

// timestamp
app.get('/api', (req, res) => {
  const now = new Date();
  res.json({ unix: now.getTime(), utc: now.toUTCString() });
});

app.get('/api/:date', (req, res) => {
  const { date } = req.params;
  const time = isUnix(date) ? new Date(parseInt(date)) : new Date(date);
  console.log(time);

  if (time == 'Invalid Date') {
    res.json({ error: 'Invalid Date' });
  } else {
    res.json({ unix: time.getTime(), utc: time.toUTCString() });
  }
});

// listen for requests :)
var listener = app.listen(port, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
