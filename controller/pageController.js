const controller =  {};
const models = require('../models'); 

const bcrypt = require('bcrypt'); // Ensure password security
const { Op, where } = require('sequelize');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { fn, col, literal } = require("sequelize");

const axios = require('axios');
const xml2js = require("xml2js");
const cheerio = require('cheerio');
const fs = require('fs');

const dotenv = require('dotenv');
dotenv.config();

const { generateScript, crawlWikipedia, crawlPubMed, crawlNature } = require('../utils/dataScript'); 
const { generateAudioScript } = require('../utils/audio');


controller.showLogin = (req, res) => {
    const errorMessage = req.flash('errorMessage');
    
    req.session.destroy(err => {
      if (err) {
        console.error('Failed to destroy session:', err);
      }
    });
  
    return res.render('login', {
      layout: 'account',
      title: 'Login',
      errorMessage,   
    });
};

controller.login = async (req, res) => {
  const { usernameOrEmail, password } = req.body; // Get login credentials from the request body

  try {
    // Check if the input is an email or username
    let user;
    if (usernameOrEmail.includes('@')) {
      // If it's an email (contains '@'), search by email
    user = await models.User.findOne({
        where: {
          email: usernameOrEmail,
        },
      });
    } 
    else {
      // If it's a username, search by username
      user = await models.User.findOne({
        where: {
          username: usernameOrEmail,
        },
      });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log(await bcrypt.hash(password, 10));
      return res.render("login", {
        layout: "account",
        title: "Login",
        errorMessage: "Invalid username, email or password.",
      });
    }

    if (!user.isVerified) {
      return res.render("login", {
        layout: "account",
        title: "Login",
        errorMessage: "This account has not been verified. Please check your email.",
      });
    }

    // Password is correct, redirect to Homepage
    req.session.userId = user.id;
    return res.redirect("/Homepage");
  } catch (error) {
    console.error(error);
    res.status(500).render("login", {
      layout: "account",
      title: "Login",
      errorMessage: "An error occurred. Please try again later."
    });
  }
};

controller.showHomepage = async (req, res) => {
  const userId = req.session.userId; 

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  res.render("homepage", { headerName: "Home", page: 1 });
};

controller.showVideo = async (req, res) => {
  const userId = req.session.userId; 

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login"); // hoặc trả lỗi nếu chưa đăng nhập
    }

    // Lấy user hiện tại
    const currentUser = await models.User.findByPk(userId);

    // Lấy tất cả video của user này
    const userVideos = await models.Video.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: models.User,
          attributes: ["username", "email"], // Chỉ lấy các thuộc tính cần thiết
        },
      ],
    });

    // Chuẩn bị dữ liệu gửi về giao diện
    const videos = userVideos.map(video => ({
      id: video.id,
      title: video.title,
      duration: video.duration,
      description: video.description,
      filename: video.filePath,
      topic: video.topic,
      createdAt: video.createdAt,
    }));

    // Gửi dữ liệu về giao diện
    res.render("video", {
      headerName: "Danh sách video",
      page: 5,
      currentUser,
      videos,
    });

  } catch (error) {
    console.error("Lỗi khi load video:", error);
    res.status(500).send("Lỗi khi lấy danh sách video");
  }
};

controller.showProfile = async (req, res) => {
  const userId = req.session.userId;

  try {
    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(500).send("Error retrieving user information");
    }

    let stats = null;
    let historicalStats = [];
    if (user.youtubeChannelId && user.youtubeVideoId) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YouTube API Key is missing.");
      }

      // Lấy thống kê kênh
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${user.youtubeChannelId}&key=${apiKey}`;
      const channelResponse = await axios.get(channelUrl);
      const channelData = channelResponse.data.items?.[0];

      // Lấy thống kê video
      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${user.youtubeVideoId}&key=${apiKey}`;
      const videoResponse = await axios.get(videoUrl);
      const videoData = videoResponse.data.items?.[0];

      if (channelData && videoData) {
        stats = {
          channelTitle: channelData.snippet.title,
          subscriberCount: parseInt(channelData.statistics.subscriberCount) || 0,
          channelVideoCount: parseInt(channelData.statistics.videoCount) || 0,
          channelViewCount: parseInt(channelData.statistics.viewCount) || 0,
          videoTitle: videoData.snippet.title,
          viewCount: parseInt(videoData.statistics.viewCount) || 0,
          likeCount: parseInt(videoData.statistics.likeCount) || 0,
          commentCount: parseInt(videoData.statistics.commentCount) || 0,
          thumbnail: videoData.snippet.thumbnails.default.url,
        };

        if (models.VideoStats) {
          await models.VideoStats.create({
            userId,
            channelId: user.youtubeChannelId,
            videoId: user.youtubeVideoId,
            viewCount: stats.viewCount,
            likeCount: stats.likeCount,
            commentCount: stats.commentCount,
            subscriberCount: stats.subscriberCount,
            channelVideoCount: stats.channelVideoCount,
            channelViewCount: stats.channelViewCount,
          });

          // Lấy dữ liệu lịch sử trong 30 ngày qua
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          historicalStats = await models.VideoStats.findAll({
            where: { 
              userId, 
              videoId: user.youtubeVideoId,
              recordedAt: { [Op.gte]: thirtyDaysAgo }
            },
            order: [['recordedAt', 'ASC']],
          });
        }
      }
    }

    res.locals.currentUser = user;
    res.locals.loggingInUser = user;
    res.locals.stats = stats;
    res.locals.historicalStats = historicalStats.map(stat => ({
      date: stat.recordedAt.toISOString().split('T')[0],
      viewCount: stat.viewCount,
      likeCount: stat.likeCount,
      commentCount: stat.commentCount,
      subscriberCount: stat.subscriberCount,
      channelVideoCount: stat.channelVideoCount,
      channelViewCount: stat.channelViewCount,
    }));

    res.render("profile", { 
      headerName: "Profile", 
      page: 3,
      stats,
      historicalStats,
    });
  } catch (error) {
    console.error("Error in showProfile:", error.message);
    res.locals.currentUser = await models.User.findByPk(userId);
    res.locals.stats = { error: error.message };
    res.render("profile", { 
      headerName: "Profile", 
      page: 3,
      stats: null,
      historicalStats: [],
    });
  }
};

controller.updateProfile = async (req, res) => {
  const userId = req.session.userId;
  const { username, bio, youtubeChannelId, youtubeVideoId } = req.body;

  try {
    const user = await models.User.findByPk(userId);
    if (!user) {
      req.flash('errorMessage', 'User not found.');
      return res.redirect('/profile');
    }

    user.username = username || user.username;
    user.bio = bio || user.bio;
    user.youtubeChannelId = youtubeChannelId || user.youtubeChannelId;
    user.youtubeVideoId = youtubeVideoId || user.youtubeVideoId;
    
    if (req.file) {
      user.profilePicture = fs.readFileSync(req.file.path).toString('base64');
      fs.unlinkSync(req.file.path);
    }

    await user.save();
    req.flash('errorMessage', 'Profile updated successfully.');
    res.redirect('/profile');
  } catch (error) {
    console.error("Error updating profile:", error.message);
    req.flash('errorMessage', 'Error updating profile. Please try again.');
    res.redirect('/profile');
  }
};

controller.genScript = async (req, res) => {
  const { topic, duration, chatbot, writingStyles } = req.body;
  console.log("Topic received:", topic + " Duration:", duration, " Chatbot:", chatbot); 

  if (!topic) return res.status(400).json({ success: false, message: "No topic provided" });
  if (chatbot !== "Gemini" && chatbot !== "Groq" && chatbot !== "OpenAI" && chatbot !== "DeepSeek") return res.status(400).json({ success: false, message: "Chatbot not available" });  
  const rawText = await crawlWikipedia(topic);
  const pubmedText = await crawlPubMed(topic); 
  const natureText = await crawlNature(topic);

  const combinedText = [rawText, pubmedText, natureText]
    .filter(text => text && text.trim().length > 0) 
    .join("\n\n"); 

  console.log("Combined Text:", combinedText);

  console.log("Raw text from Wikipedia:", rawText); 
  console.log("\nRaw text from PubMed:", pubmedText);
  console.log("\nRaw text from Nature:", natureText);
  const script = await generateScript(duration, topic, chatbot, writingStyles, rawText); 
  try {
    return res.json({ success: true, script });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Error generating script" });
  }
}

controller.genAudio = async (req, res) => {
  const {script} = req.body;

  generateAudioScript(script);
}

module.exports = controller