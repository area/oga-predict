require('dotenv').config()
const { catchAsync } = require('./utils');
const express = require('express');
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const btoa = require('btoa');
const fetch = require('node-fetch');
var session = require('express-session')
const createClient = require('redis').createClient;
const createClient3 = require('redis3').createClient;
const connectRedis = require('connect-redis');

const redis = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 5000;
const RedisStore = connectRedis(session);

async function main() {
  // Multi-process to utilize all CPU cores.
  if (!isDev && cluster.isMaster) {
    console.error(`Node cluster master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.error(`Node cluster worker ${worker.process.pid} exited: code ${code}, signal ${signal}`);
    });

  } else {
    const app = express();
    redis.on('error', (err) => console.log('Redis Client Error', err));
    await redis.connect();

    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const redirect = `${process.env.HOST}/login/callback`;

    var sess = {
      secret: process.env.SESSION_SECRET,
      cookie: {},
      store: new RedisStore({ client: createClient3({
        url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
      }) }),
    }

    if (app.get('env') === 'production') {
      app.enable('trust proxy') // trust first proxy
      sess.cookie.secure = true // serve secure cookies
    }

    app.use(session(sess))

    // Priority serve any static files.
    app.use(express.static(path.resolve(__dirname, '../react-ui/build')));

    // Answer API requests.
    app.get('/api', function (req, res) {
      res.set('Content-Type', 'application/json');
      res.send('{"message":"Hello from the custom server!"}');
    });

    app.get('/login', (req, res) => {
      res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=identify&response_type=code&redirect_uri=${redirect}`);
      });

    app.get('/login/callback', catchAsync(async (req, res) => {
      if (!req.query.code) throw new Error('NoCodeProvided');
      const code = req.query.code;
      const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('code', code);
      formData.append('redirect_uri', redirect);

      const response = await fetch(`https://discord.com/api/oauth2/token`,
        {
          method: 'POST',
          headers: {
            "Authorization": `Basic ${creds}`,
            'Accept': 'application/json',
            "Content-Type": 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        });
      const json = await response.json();
      await redis.hSet(req.session.id, 'accessToken', json.access_token);
      await redis.hSet(req.session.id, 'refreshToken', json.refresh_token);
      res.redirect(`/?token=${json.access_token}`);
    }));

    app.get('/account', catchAsync(async (req, res) => {
      if (!req.session.id){ return res.send({})}

      const token = await redis.hGet(req.session.id, 'accessToken');
      // TODO: If going to expire, refresh token
      const response = await fetch("https://discord.com/api/users/@me",
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          'Accept': 'application/json',
          "Content-Type": 'application/json'
        },
      });
      const json = await response.json()
      res.send(json)
    }));

    // All remaining requests return the React app, so it can handle routing.
    app.get('*', function(request, response) {
      response.sendFile(path.resolve(__dirname, '../react-ui/build', 'index.html'));
    });

    app.listen(PORT, function () {
      console.error(`Node ${isDev ? 'dev server' : 'cluster worker '+process.pid}: listening on port ${PORT}`);
    });
  }
}
main();
