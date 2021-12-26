require('dotenv').config();
// server.js
// where your node app starts

const dns = require('dns');
const url = require('url');

// init project
var express = require('express');
const mongoose = require('mongoose');
var app = express();
const port = process.env.PORT;

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

// URLS Shortening Service

// Build a schema and model to store saved URLS
const ShortURL = mongoose.model(
  'ShortURL',
  new mongoose.Schema({
    short_url: String,
    original_url: String,
    suffix: String,
  })
);
// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
// parse application/json
app.use(express.json());

app.post('/api/shorturl', (req, res) => {
  const bodyUrl = req.body.url;
  const parsedLookupUrl = url.parse(bodyUrl);

  if (
    parsedLookupUrl.protocol == 'http:' ||
    parsedLookupUrl.protocol == 'https:'
  ) {
    const lookupPromise = new Promise((resolve, reject) => {
      dns.lookup(parsedLookupUrl.host, (err, address, family) => {
        if (err) reject(err);
        resolve(address);
      });
    });

    lookupPromise.then(
      async function (address) {
        try {
          // check for presense in database
          let findOne = await URL.findOne({
            original_url: lookupUrl,
          });
          if (findOne) {
            res.json({
              original_url: findOne.original_url,
              short_url: findOne.short_url,
            });
          } else {
            // if the url doesn't exist in database, create new one
            findOne = new URL({
              original_url: lookupUrl,
              short_url: urlCode,
            });
            await findOne.save();
            res.json({
              original_url: findOne.original_url,
              short_url: findOne.short_url,
            });
          }
        } catch (err) {
          console.error(err);
          res.statur(500).json('Server error...');
        }
      },
      (err) => {
        res.json({ error: 'invalid url' });
      }
    );
  } else {
    res.json({ error: 'invalid url' });
  }
  // let newURL = new ShortURL({
  //   short_url: __dirname + '/api/shorturl/' + suffix,
  //   original_url: client_requested_url,
  //   suffix: suffix,
  // });

  // newURL.save((err, doc) => {
  //   if (err) return console.error(err);
  //   res.json({
  //     saved: true,
  //     short_url: newURL.short_url,
  //     orignal_url: newURL.original_url,
  //     suffix: newURL.suffix,
  //   });
  // });
});

app.get('/api/shorturl/:suffix', (req, res) => {
  let userGeneratedSuffix = req.params.suffix;
  ShortURL.find({ suffix: userGeneratedSuffix }).then((foundUrls) => {
    let urlForRedirect = foundUrls[0];
    res.redirect(urlForRedirect.original_url);
  });
});

// listen for requests :)
var listener = app.listen(port, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
