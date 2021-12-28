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
let Parser = require('rss-parser');
let parser = new Parser();
const igdb = require('igdb-api-node').default;
let igdbClient;

const redis = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 5000;
const RedisStore = connectRedis(session);
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

    // Get twitch token for igdb
    const twitchResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,{method: "POST"});
    const twitchJson = await twitchResponse.json();
    const igdbToken = twitchJson.access_token;
    const igdbClient = igdb(process.env.TWITCH_CLIENT_ID, igdbToken);

    //TODO: Set up a timer to update it based on expiry.

    const app = express();
    app.use(bodyParser.json());

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

    // Award first admin rights if necessary
    if (process.env.ADMIN){
      const isAdmin = await redis.hGet("user:" + process.env.ADMIN, "admin")
      if (!isAdmin) {
        await redis.hSet("user:" + process.env.ADMIN, "admin", "true");
      }
    }


    const gameId = await redis.get('gameId')
    if (!gameId) {
      await redis.hSet(`game:1`, "episode", "1");
      await redis.hSet(`game:1`, "name", "Super Mario Bros. 3");
      await redis.hSet(`game:1`, "rank", "1");
      await redis.hSet(`game:1`, "originalRank", "1");
      

      await redis.hSet(`game:2`, "episode", "2");
      await redis.hSet(`game:2`, "name", "Hyper Light Drifter");
      await redis.hSet(`game:2`, "rank", "2");
      await redis.hSet(`game:1`, "originalRank", "2");

      await redis.sAdd('games', 'game:1');
      await redis.sAdd('games', 'game:2');

      await redis.set('gameId', "2") 
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
      await redis.hSet(`session:${req.session.id}`, 'accessToken', json.access_token);
      await redis.hSet(`session:${req.session.id}`, 'refreshToken', json.refresh_token);
      res.redirect(`/?token=${json.access_token}`);
    }));

    app.get('/account', catchAsync(async (req, res) => {
      if (!req.session.id){ return res.send({})}

      const token = await redis.hGet(`session:${req.session.id}`, 'accessToken');
      // TODO: If going to expire, refresh token
      const response = await fetch("https://discord.com/api/users/@me",
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          'Accept': 'application/json',
          "Content-Type": 'application/json'
        },
      });
      const json = await response.json();
      if (json.id){
        await redis.hSet(`session:${req.session.id}`, 'discordId', json.id);
        await redis.hSet(`user:${json.id}`, 'uniqueName', `${json.username}#${json.discriminator}`);
        await redis.hSet(`user:${json.id}`, 'avatar', `${json.avatar}`);
      }
      const isAdmin = await redis.hGet("user:" + json.id, "admin")

      res.send({...json, admin: isAdmin === "true" })
    }));

    app.get('/api/games', catchAsync(async (req, res) => {
      const data = await redis.sendCommand(['SORT', 'games', 'BY', '*->rank', 'get', '*->name', 'get', '*->rank', 'get', '#', 'get', '*->episode', 'get', '*->coverURL', 'get', '*->igdbId']);
      const fields  = ["name", "rank", "id", "episode", "coverURL", "igdbId"] // Needs changing based on above query
      const nGames = data.length / fields.length ;
      const games = [];
      for (let i = 0; i < nGames; i+=1){
        const offset = i * fields.length;
        games.push({
          [fields[0]]: data[offset],
          [fields[1]]: data[offset+1],
          [fields[2]]: data[offset+2].split(":")[1],
          [fields[3]]: data[offset+3],
          [fields[4]]: data[offset+4],
          [fields[5]]: data[offset+5],
        })
      }
      res.send(games);
    }));

    app.post('/api/games', catchAsync(async (req, res) => {
      // Is Admin?
      const discordId = await redis.hGet(`session:${req.session.id}`, 'discordId');
      const isAdmin = await redis.hGet("user:" + discordId, "admin")
      if (!isAdmin) { return res.status(400).send() }

      // Get game id
      const nextGameId = await redis.incr('gameId')

      // Increment rank of game tied for rank and all later games, if nonzero rank
      // (i.e. if it's being added directly and we're not voting)
      if (req.body.rank !== "0") {
        const data = await redis.sendCommand(['SORT', 'games', 'alpha', 'get', '#', 'get', '*->rank']);
        const nGames = data.length / 2 ;
        for (let i = 0; i < nGames; i+=1){
          const offset = i * 2;
          const key = data[offset]
          const rank = data[offset + 1]
          if (parseInt(req.body.rank) <= parseInt(rank))  {
            // Move the game down one
            await redis.hIncrBy(key, "rank", 1);
          }
        }
      }

      // Add game
      await redis.hSet(`game:${nextGameId}`, "episode", req.body.episode);
      await redis.hSet(`game:${nextGameId}`, "name", req.body.name);
      await redis.hSet(`game:${nextGameId}`, "rank", req.body.rank);
      await redis.hSet(`game:${nextGameId}`, "originalRank", req.body.rank);

      if (req.body.igdbId){
        await redis.hSet(`game:${nextGameID}`, "igdbId", req.body.igdbId)
        const igdbResult = await igdbClient.fields('url').where(`game=${req.body.igdbId}`).request('/covers')
        await redis.hSet(`game:${nextGameID}`, "coverURL", `https:${res.data[0].url}`)
      }

      await redis.sAdd('games', `game:${nextGameId}`);

      res.send("");
    }));

    function between(t, l1, l2){
      const lower = Math.min(l1,l2);
      const upper = Math.max(l1,l2);
      return lower <= parseInt(t) && parseInt(t) <= upper;
    }

    app.post('/api/games/:id', catchAsync(async (req, res) => {
      // Is Admin?
      const discordId = await redis.hGet(`session:${req.session.id}`, 'discordId');
      const isAdmin = await redis.hGet("user:" + discordId, "admin")
      if (!isAdmin) { return res.status(403).send() }

      // Does id exist?
      let oldRank = await redis.hGet(`game:${req.params.id}`, "rank")
      if (!oldRank) { return res.status(404).send() }

      // Get all other games
      const data = await redis.sendCommand(['SORT', 'games', 'alpha', 'get', '#', 'get', '*->rank']);
      // Turn in to games objects
      const nGames = data.length / 2 ;
      let games = [];
      for (let i = 0; i < nGames; i+=1) {
        const offset = i * 2;
        games.push({
          key: data[offset],
          rank: data[offset + 1]
        })
      }

      // Remove self
      games = games.filter(game => game.key !== `game:${req.params.id}`);

      if (req.body.rank === "0" && oldRank !=="0" ){
        //Then we're removing it from the list and opening a vote...
        // All games lower move up one rank.
        for (let game of games) {
          if (parseInt(game.rank) > parseInt(oldRank)) {
            // Move the game
            await redis.hIncrBy(game.key, "rank", -1);
          }
        }
      } else if (req.body.rank !== "0" && oldRank === "0" ){
        // Then we closed a vote and inserting it in to the list.
        // All games lower move down one rank.
        for (let game of games) {
          if (parseInt(game.rank) >= parseInt(req.body.rank)) {
            // Move the game
            console.log(`bump down ${game.key}`)
            await redis.hIncrBy(game.key, "rank", 1);
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
            await redis.hIncrBy(game.key, "rank", increment);
          }
        }
      }

      // Set game
      await redis.hSet(`game:${req.params.id}`, "episode", req.body.episode);
      await redis.hSet(`game:${req.params.id}`, "name", req.body.name);
      await redis.hSet(`game:${req.params.id}`, "rank", req.body.rank);
      await redis.sAdd('games', `game:${req.params.id}`);

      if (req.body.igdbId){
        await redis.hSet(`game:${req.params.id}`, "igdbId", req.body.igdbId)
        const igdbResult = await igdbClient.fields('url').where(`game=${req.body.igdbId}`).request('/covers')
        await redis.hSet(`game:${req.params.id}`, "coverURL", `https:${igdbResult.data[0].url}`)
      }

      let feed = await parser.parseURL('https://feed.podbean.com/oldgamersalmanac/feed.xml');

      const episode = feed.items.filter(item => {
        return item.itunes.episode === req.body.episode.toString()
      })[0];


      // Did we just close a vote?
      if (oldRank === "0" && req.body.rank !== "0"){
        await redis.hSet(`game:${req.params.id}`, "voteClosedTimestamp", new Date(episode.isoDate).getTime());
        await redis.hSet(`game:${req.params.id}`, "originalRank", req.body.rank);
        let nonZeroCount = 1; // We are now in the list, but not in games which exluded ourselves
        // How many games have a non-zero rank?
        for (let i = 0; i < nGames; i+=1) {
          const offset = i * 2;
          const rank = data[offset + 1]
          if (rank !== "0"){
            nonZeroCount += 1;
          }
        }

        await redis.hSet(`game:${req.params.id}`, "originalListSize", nonZeroCount);
      }

      res.send("");
    }));

    app.get('/api/games/:id', catchAsync(async (req, res) => {
      // Does id exist?
      const data = await redis.hGet(`game:${req.params.id}`, "rank")
      if (!data) { return res.status(404).send() }

      // Update ranks for games between old a new position.
      // Whether rank goes up or down depends on which direction the game is moving
      const increment = req.body.rank > data ? 1 : -1;

      const game = {};

      // Get game
      game.episode = await redis.hGet(`game:${req.params.id}`, "episode");
      game.name = await redis.hGet(`game:${req.params.id}`, "name");
      game.rank = await redis.hGet(`game:${req.params.id}`, "rank");
      game.igdbId = await redis.hGet(`game:${req.params.id}`, "igdbId");

      res.send(game);
    }));

    app.get('/api/votes', catchAsync(async (req, res) => {
      const data = await redis.sendCommand(['SORT', 'games', 'BY', '*->rank', 'get', '*->name', 'get', '*->rank', 'get', '#']);
      const fields  = ["name", "rank", "id"] // Needs changing based on above query
      const nGames = data.length / fields.length ;
      const games = [];
      for (let i = 0; i < nGames; i+=1){
        const offset = i * fields.length;
        games.push({
          [fields[0]]: data[offset],
          [fields[1]]: data[offset+1],
          [fields[2]]: data[offset+2].split(":")[1],
        })
      }
      res.send(games.filter(game => game.rank === "0"));
    }));


    app.post('/api/vote', catchAsync(async (req, res) => {
      // Is logged in?
      const discordId = await redis.hGet(`session:${req.session.id}`, 'discordId');
      if (!discordId) { return res.status(400).send() }

      // Is gameID Voting?
      let oldRank = await redis.hGet(`game:${req.body.id}`, "rank")
      if (oldRank !== "0" ) { return res.status(404).send() }

      // Record vote for user
      // Record game id, timestamp, predicted rank
      await redis.sAdd(`voters`, discordId)
      await redis.sAdd(`${discordId}:votes`, req.body.id)
      await redis.hSet(`${discordId}:vote:${req.body.id}`, "timestamp", Date.now())
      await redis.hSet(`${discordId}:vote:${req.body.id}`, "rank", req.body.rank)

      res.send("");
    }));

    app.get('/api/votes/mine', catchAsync(async (req, res) => {
      // Is logged in?
      const discordId = await redis.hGet(`session:${req.session.id}`, 'discordId');
      if (!discordId) { return res.status(400).send() }
      const data = await redis.sendCommand(['SORT', `${discordId}:votes`, 'BY', '*->rank', 'get', '#', 'get', `${discordId}:vote:*->timestamp`, 'get', `${discordId}:vote:*->rank`]);
      const fields  = ["id", "timestamp", "rank"] // Needs changing based on above query
      const nGames = data.length / fields.length ;
      const votes = [];
      for (let i = 0; i < nGames; i+=1){
        const offset = i * fields.length;
        votes.push({
          [fields[0]]: data[offset],
          [fields[1]]: data[offset+1],
          [fields[2]]: data[offset+2],
        })
      }

      res.send(votes);
    }));

    app.get('/api/leaderboard', catchAsync(async (req, res) => {
      // Get users who voted
      const users = await redis.sMembers("voters")
      const data = await redis.sendCommand(['SORT', 'games', 'BY', '*->rank', 'get', '*->rank']);
      const fields  = ["rank"] // Needs changing based on above query
      const currentListSize = data.filter(x => x !== "0").length

      // For each user ...
      let leaderboard = await Promise.all(
        users.map(async (userid) => {
          // For each game they voted for...
          const gameIds = await redis.sMembers(`${userid}:votes`)
          let scores = await Promise.all(gameIds.map(async (gameId) => {
            // get vote
            const vote = await redis.hGetAll(`${userid}:vote:${gameId}`);
            // get actual rank
            const gameRank = await redis.hGet(`game:${gameId}`, 'originalRank');
            const gameVoteClosed = await redis.hGet(`game:${gameId}`, 'voteClosedTimestamp');

            if (vote.timestamp > gameVoteClosed){ return Infinity };
            const originalListSize = await redis.hGet(`game:${gameId}`, 'originalListSize');
            return ((vote.rank-gameRank)/originalListSize)**2
          }))
          const user = await redis.hGetAll(`user:${userid}`);
          scores = scores.filter(x => x !==Infinity)
          let score;
          if (scores.length === 0){
            score = Infinity;
          } else {
            score = Math.sqrt(scores.reduce((prev, curr) => prev + curr)/scores.length)
          }
          score = (score * currentListSize).toFixed(2)

          return {name: user.uniqueName, score, nVotes:scores.length, avatar: `https://cdn.discordapp.com/avatars/${userid}/${user.avatar}.png` };
        })
      );

      // Filter out anyone who only voted late
      leaderboard = leaderboard.filter(x => x.nVotes !== 0);

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
  }
}
main();
