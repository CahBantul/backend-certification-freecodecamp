require('dotenv').config();
// server.js
// where your node app starts

const dns = require('dns');
const url = require('url');

// init project
var express = require('express');
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
app.get('/exercise-tracker', (req, res) => {
  res.sendFile(__dirname + '/views/exerciseTracker.html');
});

// request Header Parser
app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.connection.remoteAddress,
    language: req.headers['accept-language'],
    software: req.headers['user-agent'],
  });
});

// URLS Shortening Service

// create url model
const Schema = mongoose.Schema;
const urlSchema = new Schema({
  original_url: String,
  short_url: Number,
});
const URL = mongoose.model('URL', urlSchema);

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
// parse application/json
app.use(express.json());

// api endpoint
app.post('/api/shorturl', async function (req, res) {
  const lookupUrl = req.body.url;
  const parsedLookupUrl = url.parse(lookupUrl);

  let urlCode = await URL.count();
  urlCode++;

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
});

app.get('/api/shorturl/:short_url?', async function (req, res) {
  try {
    const urlParams = await URL.findOne({
      short_url: req.params.short_url,
    });
    if (urlParams) {
      return res.redirect(urlParams.original_url);
    } else {
      return res.status(404).json('No URL found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).json('Server error...');
  }
});

// exercise tracker
// Schemas
const userSchema = new Schema({
  username: String,
});

const exerciseSchema = new Schema({
  username: String,
  date: Date,
  duration: Number,
  description: String,
});

const logSchema = new Schema({
  username: String,
  count: Number,
  log: Array,
});

// Models
const UserInfo = mongoose.model('userInfo', userSchema);
const ExerciseInfo = mongoose.model('exerciseInfo', exerciseSchema);
const LogInfo = mongoose.model('logInfo', logSchema);

// #1
app.post('/api/users', (req, res) => {
  UserInfo.find({ username: req.body.username }, (err, userData) => {
    if (err) {
      console.log('Error with server=> ', err);
    } else {
      if (userData.length === 0) {
        const test = new UserInfo({
          _id: req.body.id,
          username: req.body.username,
        });

        test.save((err, data) => {
          if (err) {
            console.log('Error saving data=> ', err);
          } else {
            res.json({
              _id: data.id,
              username: data.username,
            });
          }
        });
      } else {
        res.send('Username already Exists');
      }
    }
  });
});

// #2
app.post('/api/users/:_id/exercises', (req, res) => {
  let idJson = { id: req.params._id };
  let checkedDate = new Date(req.body.date);
  let idToCheck = idJson.id;

  let noDateHandler = () => {
    if (checkedDate instanceof Date && !isNaN(checkedDate)) {
      return checkedDate;
    } else {
      checkedDate = new Date();
    }
  };

  UserInfo.findById(idToCheck, (err, data) => {
    noDateHandler(checkedDate);

    if (err) {
      console.log('error with id=> ', err);
    } else {
      const test = new ExerciseInfo({
        username: data.username,
        description: req.body.description,
        duration: req.body.duration,
        date: checkedDate.toDateString(),
      });

      test.save((err, data) => {
        if (err) {
          console.log('error saving=> ', err);
        } else {
          console.log('saved exercise successfully');
          res.json({
            _id: idToCheck,
            username: data.username,
            description: data.description,
            duration: data.duration,
            date: data.date.toDateString(),
          });
        }
      });
    }
  });
});

// #3

app.get('/api/users/:_id/logs', (req, res) => {
  const { from, to, limit } = req.query;
  let idJson = { id: req.params._id };
  let idToCheck = idJson.id;

  // Check ID
  UserInfo.findById(idToCheck, (err, data) => {
    var query = {
      username: data.username,
    };

    if (from !== undefined && to === undefined) {
      query.date = { $gte: new Date(from) };
    } else if (to !== undefined && from === undefined) {
      query.date = { $lte: new Date(to) };
    } else if (from !== undefined && to !== undefined) {
      query.date = { $gte: new Date(from), $lte: new Date(to) };
    }

    let limitChecker = (limit) => {
      let maxLimit = 100;
      if (limit) {
        return limit;
      } else {
        return maxLimit;
      }
    };

    if (err) {
      console.log('error with ID=> ', err);
    } else {
      ExerciseInfo.find(
        query,
        null,
        { limit: limitChecker(+limit) },
        (err, docs) => {
          let loggedArray = [];
          if (err) {
            console.log('error with query=> ', err);
          } else {
            let documents = docs;
            let loggedArray = documents.map((item) => {
              return {
                description: item.description,
                duration: item.duration,
                date: item.date.toDateString(),
              };
            });

            const test = new LogInfo({
              username: data.username,
              count: loggedArray.length,
              log: loggedArray,
            });

            test.save((err, data) => {
              if (err) {
                console.log('error saving exercise=> ', err);
              } else {
                console.log('saved exercise successfully');
                res.json({
                  _id: idToCheck,
                  username: data.username,
                  count: data.count,
                  log: loggedArray,
                });
              }
            });
          }
        }
      );
    }
  });
});

// #4
app.get('/api/users', (req, res) => {
  UserInfo.find({}, (err, data) => {
    if (err) {
      res.send('No Users');
    } else {
      res.json(data);
    }
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
