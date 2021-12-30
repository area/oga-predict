require('dotenv').config()
const { catchAsync } = require('./utils');
const express = require('express');
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const btoa = require('btoa');
const fetch = require('node-fetch');
var session = require('express-session')
let Parser = require('rss-parser');
let parser = new Parser();
const igdb = require('igdb-api-node').default;
let igdbClient;
const { Client, Pool } = require('pg')

const isDev = process.env.NODE_ENV !== 'production';

const postgresOptions = {connectionString: process.env.DATABASE_URL};
if (!isDev){
  postgresOptions.ssl = { rejectUnauthorized: false }
} 

const pool = new Pool(postgresOptions);

const PORT = process.env.PORT || 5000;
const bodyParser = require('body-parser');

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
    // const client = new Client(postgresOptions)

    // Get twitch token for igdb
    const twitchResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,{method: "POST"});
    const twitchJson = await twitchResponse.json();
    const igdbToken = twitchJson.access_token;
    const igdbClient = igdb(process.env.TWITCH_CLIENT_ID, igdbToken);

    //TODO: Set up a timer to update it based on expiry.

    const app = express();
    app.use(bodyParser.json());

    // await client.connect()
    await setupDb()

    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const redirect = `${process.env.HOST}/login/callback`;

    var sess = {
      secret: process.env.SESSION_SECRET,
      cookie: {},
      store:new (require('connect-pg-simple')(session))({"pool": pool, "createTableIfMissing": true}), // DATABASE_URL is postgres, this will work
    }

    if (app.get('env') === 'production') {
      app.enable('trust proxy') // trust first proxy
      sess.cookie.secure = true // serve secure cookies
    }

    // Award first admin rights if necessary
    if (process.env.ADMIN){
      const isAdmin = await isUserAdmin(process.env.ADMIN);
      if (!isAdmin) {
        await setUserAdmin(process.env.ADMIN, true);
      }
    }

    // If no data, add some games
    let res = await pool.query("SELECT COUNT(1) FROM games");
    if (res.rows[0].count === "0") {
      // Add some starting data
      await pool.query("INSERT INTO games (episodeId, name, rank, originalRank, igdbid) VALUES ('1', 'Super Mario Bros. 3', '1', '1', '1068')")
      await pool.query("INSERT INTO games (episodeId, name, rank, originalRank) VALUES ('2', 'Hyper Light Drifter', '2', '2')")
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
      req.session.accessToken = json.access_token;
      req.session.refreshToken = json.refresh_token;
      res.redirect(`/`);
    }));

    app.get('/account', catchAsync(async (req, res) => {
      if (!req.session.id){ return res.send({})}

      // TODO: If going to expire, refresh token
      const response = await fetch("https://discord.com/api/users/@me",
      {
        headers: {
          "Authorization": `Bearer ${req.session.accessToken}`,
          'Accept': 'application/json',
          "Content-Type": 'application/json'
        },
      });
      const json = await response.json();
      if (json.id){
        req.session.discordid = json.id;
        await pool.query(`INSERT INTO users (discordId, uniqueName, avatar) VALUES ($1,$2,$3) ON CONFLICT (discordId) DO UPDATE SET (uniqueName, avatar) = ($2,$3)`,[json.id, `${json.username}#${json.discriminator}`, json.avatar])
      }
      const isAdmin = await isUserAdmin(json.id);
      res.send({...json, admin: isAdmin === true })
    }));

    app.get('/api/games', catchAsync(async (req, res) => {
      const data = await pool.query("SELECT games.id as gameid, rank, name, games.episodeid, coverURL, igdbid, episodes.url as episodeurl FROM games LEFT JOIN episodes ON games.episodeid = episodes.id ORDER BY games.rank ASC");
      res.send(data.rows);
    }));

    app.post('/api/games', catchAsync(async (req, res) => {
      // Is Admin?
      const isAdmin = await isUserAdmin(req.session.discordid);
      if (!isAdmin) { return res.status(400).send() }

      let coverURL;
      if (req.body.igdbid){
        const igdbResult = await igdbClient.fields('url').where(`game=${req.body.igdbid}`).request('/covers')
        coverURL = `https:${igdbResult.data[0].url.replace('thumb','cover_small')}`;
      }
      // Add game
      await pool.query("INSERT INTO games (episodeid, name, rank, originalrank, igdbid, coverurl) VALUES ($1, $2, $3, $4, $5, $6)", [req.body.episodeid, req.body.name, req.body.rank, req.body.rank, req.body.igdbid, coverURL])

      // Increment rank of game tied for rank and all later games, if nonzero rank
      // (i.e. if it's being added directly and we're not voting)
      if (req.body.rank !== "0") {
        // This idgb at the end is a bit of a kludge... but works.
        const data = await pool.query("SELECT id,rank from games WHERE rank >= $1 AND rank != 0 AND igdbid != $2", [req.body.rank, req.body.igdbid]);
        for (let game of data.rows){
          await pool.query("UPDATE games SET rank=$1 WHERE id = $2", [game.rank + 1, game.id])
        }
      }

      // Populate episode information
      let feed = await parser.parseURL('https://feed.podbean.com/oldgamersalmanac/feed.xml');

      const episode = feed.items.filter(item => {
        return item.itunes.episode === req.body.episodeid.toString()
      })[0];

      if (episode){
        await pool.query(`INSERT INTO episodes (id, url) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET url = $2`, [req.params.id, episode.link])
      }

      res.send("");
    }));

    function between(t, l1, l2){
      l1 = parseInt(l1)
      l2 = parseInt(l2)
      const lower = Math.min(l1,l2);
      const upper = Math.max(l1,l2);
      return lower <= parseInt(t) && parseInt(t) <= upper;
    }

    app.post('/api/games/:id', catchAsync(async (req, res) => {
      // Is Admin?
      const isAdmin = await isUserAdmin(req.session.discordid);
      if (!isAdmin) { return res.status(403).send() }

      // Does id exist?
      let data = await pool.query("SELECT rank FROM games WHERE id = $1", [req.params.id]);
      if (data.rows.length === 0) { return res.status(404).send() }
      let oldRank = data.rows[0].rank;

      // Get all other games that aren't being voted on
      data = await pool.query("SELECT rank, id FROM games WHERE id != $1 AND rank != 0", [req.params.id]);
      games = data.rows;

      // Get all predictions not about this game
      data = await pool.query("SELECT prediction, discordid, gameid FROM predictions where gameid != $1", [req.params.id]);
      const predictions = data.rows;

      if (req.body.rank === "0" && oldRank !== 0 ){
        //Then we're removing it from the list and opening a prediction...
        // All games lower move up one rank.
        for (let game of games) {
          if (parseInt(game.rank) > parseInt(oldRank)) {
            // Move the game
            await pool.query("UPDATE games SET rank=$1 WHERE id = $2", [game.rank - 1, game.id])
          }
        }
        // All predictions for a lower slot move up one rank
        for (let prediction of predictions) {
          if (parseInt(prediction.prediction) > parseInt(oldRank)) {
            // Move the prediction
            await pool.query("UPDATE predictions SET prediction=$1 WHERE gameid = $2 AND discordid = $3", [prediction.prediction - 1, prediction.gameid, prediction.discordid])
          }
        }
      } else if (req.body.rank !== "0" && oldRank === 0 ){
        // Then we closed a prediction and inserting it in to the list.
        // All games lower move down one rank.
        for (let game of games) {
          if (parseInt(game.rank) >= parseInt(req.body.rank)) {
            // Move the game
            await pool.query("UPDATE games SET rank=$1 WHERE id = $2", [game.rank + 1, game.id])
          }
        }
        // All predictions for a lower slot move down one
        for (let prediction of predictions) {
          if (parseInt(prediction.prediction) >= parseInt(oldRank)) {
            // Move the prediction
            await pool.query("UPDATE predictions SET prediction=$1 WHERE gameid = $2 AND discordid = $3", [prediction.prediction - 1, prediction.gameid, prediction.discordid])
          }
        }
      } else {
        // We're moving it within the list
        // Update ranks for games between old a new position.
        // Whether rank goes up or down depends on which direction the game is moving
        const increment = req.body.rank > oldRank ? -1 : 1;

        for (let game of games) {
          if (between(game.rank, req.body.rank, oldRank)){
            // Move the game
            await pool.query("UPDATE games SET rank=$1 WHERE id = $2", [game.rank + increment, game.id])
          }
        }
        // Same for predictions
        for (let prediction of predictions) {
          if (between(prediction.prediction, req.body.rank, oldRank)) {
            // Move the prediction
            await pool.query("UPDATE predictions SET prediction=$1 WHERE gameid = $2 AND discordid = $3", [prediction.prediction + increment, prediction.gameid, prediction.discordid])
          }
        }
      }

      let coverURL;
      if (req.body.igdbid){
        const igdbResult = await igdbClient.fields('url').where(`game=${req.body.igdbid}`).request('/covers')
        coverURL = `https:${igdbResult.data[0].url.replace('thumb','cover_small')}`;
      }
      // Add game
      await pool.query("UPDATE games SET (episodeid, name, rank, originalrank, igdbid, coverurl) = ($1, $2, $3, $4, $5, $6) WHERE id = $7", [req.body.episodeid, req.body.name, req.body.rank, req.body.rank, req.body.igdbid, coverURL, req.params.id])

      let feed = await parser.parseURL('https://feed.podbean.com/oldgamersalmanac/feed.xml');

      const episode = feed.items.filter(item => {
        return item.itunes.episode === req.body.episodeid.toString()
      })[0];

      if (episode){
        await pool.query(`INSERT INTO episodes (id, url) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET url = $2`, [req.params.id, episode.link])
      }

      // Did we just close a predict?
      if (oldRank === 0 && req.body.rank !== "0"){
        let nonZeroCount = games.filter(x => x.rank != 0).length + 1; // We are now in the list, but not in games which exluded ourselves
        let date;
        if (!episode?.isoDate) { date = Date.now()} else { date = episode.isoDate}
        await pool.query("UPDATE games SET (predictclosedtimestamp, originalrank, originallistsize) = ($1, $2, $3) WHERE id = $4", [Math.floor(new Date(date).getTime()/1000), req.body.rank, nonZeroCount, req.params.id])

      }

      res.send("");
    }));

    app.get('/api/games/:id', catchAsync(async (req, res) => {
      // Does id exist?
      let data = await pool.query("SELECT * FROM games WHERE id = $1", [req.params.id]);
      res.send(data.rows[0])
    }));

    app.get('/api/predictions', catchAsync(async (req, res) => {
      let data = await pool.query("SELECT * FROM games WHERE rank = 0");
      res.send(data.rows)
    }));


    app.post('/api/predict', catchAsync(async (req, res) => {
      // Is logged in?
      const discordId = req.session.discordid;
      if (!discordId) { return res.status(400).send() }

      // Is gameID Voting?
      let data = await pool.query("SELECT rank FROM games WHERE id = $1", [req.body.id]);
      if (data.rows.length === 0) { return res.status(404).send() }
      let oldRank = data.rows[0].rank;
      if (oldRank !== 0 ) { return res.status(404).send() }

      // Record predict for user
      // Record game id, timestamp, predicted rank
      await pool.query(`INSERT INTO predictions (discordid, gameid, prediction, timestamp) VALUES ($1,$2,$3,$4) ON CONFLICT (discordid, gameid) DO UPDATE SET (prediction, timestamp) = ($3, $4)`, [discordId, req.body.id, req.body.rank, Math.floor(Date.now()/1000)])

      res.send("");
    }));

    app.get('/api/predictions/mine', catchAsync(async (req, res) => {
      // Is logged in?
      const discordId = req.session.discordid;
      if (!discordId) { return res.status(400).send() }

      let data = await pool.query("SELECT * FROM predictions WHERE discordid = $1", [req.session.discordid])
      res.send(data.rows)
    }));

    app.get('/api/leaderboard', catchAsync(async (req, res) => {

      // Get predictions
      let data = await pool.query("SELECT predictions.discordid, predictions.prediction, predictions.timestamp, games.originalrank, games.predictclosedtimestamp, games.originallistsize FROM predictions INNER JOIN games ON predictions.gameid = games.id")
      //For each prediction, work out the score, and add to an array for the corresponding user.
      const users = {}
      data.rows.forEach(prediction => {
        // Did they vote after the episode released?
        if (prediction.timestamp > prediction.predictclosedtimestamp) { return; }

        const score = ((prediction.prediction-prediction.originalrank)/prediction.originallistsize)**2
        if (!users[prediction.discordid]) { users[prediction.discordid] = []; }
        users[prediction.discordid] = [score].concat(users[prediction.discordid] )
      })

      data = await pool.query("SELECT COUNT(1) FROM games WHERE rank != 0");
      const currentListSize = data.rows[0].count

      let leaderboard = await Promise.all(Object.keys(users).map(async (userid) => {
        const data = await pool.query("SELECT * FROM users WHERE discordid = $1", [userid]);
        const userdata = data.rows[0]
        const scores = users[userid].filter(x => x !==Infinity)
        let score;
        if (scores.length === 0){
          score = Infinity;
        } else {
          score = Math.sqrt(scores.reduce((prev, curr) => prev + curr)/scores.length)
        }
        score = (score * currentListSize).toFixed(2)

        return {name: userdata.uniquename, score, nPredicts:users[userid].length, avatar: `https://cdn.discordapp.com/avatars/${userid}/${userdata.avatar}.png` };
      }));

      // Filter out anyone who only predicted late
      leaderboard = leaderboard.filter(x => x.nPredicts !== 0);

      // Order users by score.
      leaderboard.sort((a,b) => a.score - b.score)

      res.send(leaderboard);
    }));

    // All remaining requests return the React app, so it can handle routing.
    app.get('*', function(request, response) {
      response.sendFile(path.resolve(__dirname, '../react-ui/build', 'index.html'));
    });

    app.listen(PORT, function () {
      console.error(`Node ${isDev ? 'dev server' : 'cluster worker '+process.pid}: listening on port ${PORT}`);
    });

    async function setupDb(){
      // Predictions
      await pool.query(`CREATE TABLE IF NOT EXISTS predictions (
        discordid text NOT NULL,
        gameid int NOT NULL,
        prediction int NOT NULL,
        timestamp int NOT NULL,
        PRIMARY KEY(discordid, gameid)
      );`)


      // //Games
      // gameid episodeid name rank originalRank originalListSize predictCloseTimestamp coverURL igdbid 
      await pool.query(`CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        episodeid int,
        name text NOT NULL,
        rank int NOT NULL,
        originalrank int,
        originallistsize int,
        predictclosedtimestamp int,
        coverurl text,
        igdbid int
      );`)

      // //Episodes
      // episodeid episodeLink
      await pool.query(`CREATE TABLE IF NOT EXISTS episodes (
        id int NOT NULL PRIMARY KEY,
        url text
      );`);

      // //Users
      // discordId  admin uniqueName avatar
      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        discordid text NOT NULL PRIMARY KEY,
        admin bool,
        uniquename text,
        avatar text
      );`);
    }

    async function isUserAdmin(discordId){
      const data = await pool.query(`SELECT admin FROM users WHERE discordid='${discordId}'`);
      return data.rows[0]?.admin === true;
    }

    async function setUserAdmin(discordId, state){
      const res = await pool.query(`INSERT INTO users (discordid, admin) VALUES ($1,$2) ON CONFLICT (discordid) DO UPDATE SET admin = $2`, [discordId, state])
    }
  }

}
main();


