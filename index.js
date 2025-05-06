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
        },
    })
);
app.set("view engine", "hbs");

// Middleware to parse JSON 
app.use(express.json());
app.use(express .urlencoded({ extended: false }));

// Cron Job để cập nhật thống kê YouTube
cron.schedule('*/5 * * * *', async () => {
  console.log('Starting YouTube stats update cron job at:', new Date().toISOString());
  try {
    if (!models.VideoStats) {
      console.error('VideoStats model is not defined. Please check model configuration.');
      return;
    }

    if (!process.env.YOUTUBE_API_KEY) {
      console.error('YOUTUBE_API_KEY is missing in .env file.');
      return;
    }

    const users = await models.User.findAll({ 
      where: { 
        youtubeChannelId: { [Op.ne]: null },
        youtubeVideoId: { [Op.ne]: null }
      },
      attributes: ['id', 'youtubeChannelId', 'youtubeVideoId'],
    });

    console.log(`Found ${users.length} users with YouTube Channel ID and Video ID.`);

    if (users.length === 0) {
      console.log('No users with YouTube Channel ID and Video ID found. Skipping update.');
      return;
    }

    for (const user of users) {
      console.log(`Fetching stats for user ${user.id}, channel ${user.youtubeChannelId}, video ${user.youtubeVideoId}`);
      try {
        // Lấy thống kê kênh
        const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${user.youtubeChannelId}&key=${process.env.YOUTUBE_API_KEY}`;
        const channelResponse = await axios.get(channelUrl);
        const channelData = channelResponse.data.items?.[0];

        // Lấy thống kê video
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${user.youtubeVideoId}&key=${process.env.YOUTUBE_API_KEY}`;
        const videoResponse = await axios.get(videoUrl);
        const videoData = videoResponse.data.items?.[0];

        if (channelData && videoData) {
          await models.VideoStats.create({
            userId: user.id,
            channelId: user.youtubeChannelId,
            videoId: user.youtubeVideoId,
            viewCount: parseInt(videoData.statistics.viewCount) || 0,
            likeCount: parseInt(videoData.statistics.likeCount) || 0,
            commentCount: parseInt(videoData.statistics.commentCount) || 0,
            subscriberCount: parseInt(channelData.statistics.subscriberCount) || 0,
            channelVideoCount: parseInt(channelData.statistics.videoCount) || 0,
            channelViewCount: parseInt(channelData.statistics.viewCount) || 0,
          });
          console.log(`Successfully updated stats for user ${user.id}, channel ${user.youtubeChannelId}, video ${user.youtubeVideoId}`);
        } else {
          console.warn(`No data found for channel ${user.youtubeChannelId} or video ${user.youtubeVideoId}`);
        }
      } catch (apiError) {
        console.error(`Error fetching stats for channel ${user.youtubeChannelId} or video ${user.youtubeVideoId}:`, apiError.message);
      }
    }
    console.log('YouTube stats update completed at:', new Date().toISOString());
  } catch (error) {
    console.error('Error in YouTube stats cron job:', error.message);
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

// Tuyến đường thử nghiệm để chạy cron job thủ công
app.get('/run-youtube-stats', async (req, res) => {
  console.log('Manually running YouTube stats update...');
  try {
    const users = await models.User.findAll({ 
      where: { 
        youtubeChannelId: { [Op.ne]: null },
        youtubeVideoId: { [Op.ne]: null }
      },
      attributes: ['id', 'youtubeChannelId', 'youtubeVideoId'],
    });
    for (const user of users) {
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${user.youtubeChannelId}&key=${process.env.YOUTUBE_API_KEY}`;
      const channelResponse = await axios.get(channelUrl);
      const channelData = channelResponse.data.items?.[0];

      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${user.youtubeVideoId}&key=${process.env.YOUTUBE_API_KEY}`;
      const videoResponse = await axios.get(videoUrl);
      const videoData = videoResponse.data.items?.[0];

      if (channelData && videoData) {
        await models.VideoStats.create({
          userId: user.id,
          channelId: user.youtubeChannelId,
          videoId: user.youtubeVideoId,
          viewCount: parseInt(videoData.statistics.viewCount) || 0,
          likeCount: parseInt(videoData.statistics.likeCount) || 0,
          commentCount: parseInt(videoData.statistics.commentCount) || 0,
          subscriberCount: parseInt(channelData.statistics.subscriberCount) || 0,
          channelVideoCount: parseInt(channelData.statistics.videoCount) || 0,
          channelViewCount: parseInt(channelData.statistics.viewCount) || 0,
        });
      }
    }
    res.send('YouTube stats update completed.');
  } catch (error) {
    console.error('Error in manual YouTube stats update:', error.message);
    res.status(500).send('Error updating YouTube stats.');
  }
});

app.get("/", (req,res) => res.redirect("/Login"));

app.use("/Homepage", ensureAuthenticated, require("./routes/pageRouter"));
app.use("/Video", ensureAuthenticated, require("./routes/videoRouter"));
app.use("/Profile", ensureAuthenticated, require("./routes/profileRouter"));

app.use("/Login", require("./routes/loginRouter"));
//app.use("/CreateAccount", require("./routes/createRouter"));


app.listen(port, () => console.log(`listening on port ${port}`));