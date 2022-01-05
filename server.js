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

// create url model
const Schema = mongoose.Schema;
const urlSchema = new Schema({
  original_url: String,
  short_url: Number,
});
const URL = mongoose.model('URL', urlSchema);

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
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
const ExerciseSchema = new Schema({
  userId: { type: String, required: true },
  description: String,
  duration: Number,
  date: Date,
});
const UserSchema = new Schema({
  username: String,
});
const User = mongoose.model('User', UserSchema);
const Exercise = mongoose.model('Exercise', ExerciseSchema);
app.post('/api/users', (req, res) => {
  console.log(`req.body`, req.body);
  const newUser = new User({
    username: req.body.username,
  });
  newUser.save((err, data) => {
    if (err || !data) {
      res.send('There was an error saving the user');
    } else {
      res.json(data);
    }
  });
});

app.post('/api/users/:id/exercises', (req, res) => {
  const id = req.params.id;
  const { description, duration, date } = req.body;
  User.findById(id, (err, userData) => {
    if (err || !userData) {
      res.send('Could not find user');
    } else {
      const newExercise = new Exercise({
        userId: id,
        description,
        duration,
        date: new Date(date),
      });
      newExercise.save((err, data) => {
        if (err || !data) {
          res.send('There was an error saving this exercise');
        } else {
          const { description, duration, date, _id } = data;
          res.json({
            username: userData.username,
            description,
            duration,
            date: date.toDateString(),
            _id: userData.id,
          });
        }
      });
    }
  });
});

app.get('/api/users/:id/logs', (req, res) => {
  const { from, to, limit } = req.query;
  const { id } = req.params;
  User.findById(id, (err, userData) => {
    if (err || !userData) {
      res.send('Could not find user');
    } else {
      let dateObj = {};
      if (from) {
        dateObj['$gte'] = new Date(from);
      }
      if (to) {
        dateObj['$lte'] = new Date(to);
      }
      let filter = {
        userId: id,
      };
      if (from || to) {
        filter.date = dateObj;
      }
      let nonNullLimit = limit ?? 500;
      Exercise.find(filter)
        .limit(+nonNullLimit)
        .exec((err, data) => {
          if (err || !data) {
            res.json([]);
          } else {
            const count = data.length;
            const rawLog = data;
            const { username, _id } = userData;
            const log = rawLog.map((l) => ({
              description: l.description,
              duration: l.duration,
              date: l.date.toDateString(),
            }));
            res.json({ username, count, _id, log });
          }
        });
    }
  });
});

app.get('/api/users', (req, res) => {
  User.find({}, (err, data) => {
    if (!data) {
      res.send('No users');
    } else {
      res.json(data);
    }
  });
});

// listen for requests :)
var listener = app.listen(port, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
