const express = require("express");
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
const port = process.env.PORT || 3000;
const expressHbs = require("express-handlebars");
const moment = require('moment');
const cron = require('node-cron');
const axios = require('axios');
const models = require('./models');
const path = require("path");
const ffmpeg = require('fluent-ffmpeg');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuid } = require('uuid');

// Flash messages setup
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());

// Check authentication
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    console.log("Checking authentication success:", req.session);
    next();
  } else {
    console.log("Checking authentication failed:", req.session);
    req.flash('errorMessage', 'You must be logged in to view this page.');
    res.redirect("/Login"); // Redirect to login if not authenticated
  }
}

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.static(__dirname + "/public"));

app.engine(
    'hbs', 
    expressHbs.engine({
        layoutsDir: __dirname + "/views/layouts",
        partialsDir: __dirname + "/views/partials",
        extname: "hbs",
        defaultLayout: "layout",
        runtimeOptions: {
          allowProtoPropertiesByDefault: true,
      },
        helpers: {
          includes: (array, value) => {
            return Array.isArray(array) && array.includes(value);
          },
            eq: function (a, b) {
              return a === b; // Return true if a and b are strictly equal
            },
            formatDate: (date) => {
              return new Date(date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
              });
          },
            timeAgo: (createdAt) => {
              const now = moment();
              const then = moment(createdAt);
              const duration = moment.duration(now.diff(then));
              
              if (duration.asSeconds() < 60) {
                return 'Just now';
              } else if (duration.asMinutes() < 60) {
                return `${Math.floor(duration.asMinutes())}m`;
              } else if (duration.asHours() < 24) {
                return `${Math.floor(duration.asHours())}h`;
              } else {
                return then.fromNow(); 
              }
            },
            json: (context) => JSON.stringify(context),
        },
    })
);
app.set("view engine", "hbs");

// Middleware to parse JSON 
app.use(express.json());
app.use(express .urlencoded({ extended: false }));

// Chạy mỗi ngày lúc 00:00
cron.schedule('0 0 * * *', async () => {
  try {
    const users = await models.User.findAll({ where: { youtubeChannelId: { [Op.ne]: null } } });
    for (const user of users) {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${user.youtubeChannelId}&key=${process.env.YOUTUBE_API_KEY}`;
      const response = await axios.get(url);
      const channelData = response.data.items?.[0];
      if (channelData) {
        await models.ChannelStats.create({
          userId: user.id,
          subscriberCount: parseInt(channelData.statistics.subscriberCount),
          videoCount: parseInt(channelData.statistics.videoCount),
          viewCount: parseInt(channelData.statistics.viewCount),
        });
      }
    }
    console.log('YouTube stats updated');
  } catch (error) {
    console.error('Error updating YouTube stats:', error);
  }
}); 

app.get("/", (req,res) => res.redirect("/Login"));

app.use("/Homepage", ensureAuthenticated, require("./routes/pageRouter"));
app.use("/Video", ensureAuthenticated, require("./routes/videoRouter"));
app.use("/Profile", ensureAuthenticated, require("./routes/profileRouter"));
app.use("/Login", require("./routes/loginRouter"));
//app.use("/CreateAccount", require("./routes/createRouter"));


// Utility: download a remote URL to local file
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed: ' + url);
  const fileStream = fs.createWriteStream(dest);
  await new Promise((r, e) => {
    res.body.pipe(fileStream);
    res.body.on("error", e);
    fileStream.on("finish", r);
  });
}



app.listen(port, () => console.log(`listening on port ${port}`));