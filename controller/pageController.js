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

controller.showEditVideo = async (req, res) => {
  const userId = req.session.userId; 

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  res.render("editVideo", { headerName: "Edit video", page: 2 });
};

controller.showProfile = async (req, res) => {
  const userId = req.session.userId;

  try {
    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(500).send("Error retrieving user information");
    }

    let youtubeStats = null;
    let historicalStats = [];
    if (user.youtubeChannelId) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YouTube API Key is missing.");
      }
      const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${user.youtubeChannelId}&key=${apiKey}`;
      
      const response = await axios.get(url);
      const channelData = response.data.items?.[0];
      
      if (channelData) {
        youtubeStats = {
          channelTitle: channelData.snippet.title,
          subscriberCount: parseInt(channelData.statistics.subscriberCount),
          videoCount: parseInt(channelData.statistics.videoCount),
          viewCount: parseInt(channelData.statistics.viewCount),
          thumbnail: channelData.snippet.thumbnails.default.url,
        };

        if (models.ChannelStats) {
          await models.ChannelStats.create({
            userId,
            subscriberCount: youtubeStats.subscriberCount,
            videoCount: youtubeStats.videoCount,
            viewCount: youtubeStats.viewCount,
          });

          historicalStats = await models.ChannelStats.findAll({
            where: { userId },
            order: [['recordedAt', 'ASC']],
            limit: 7,
          });
        }
      }
    }

    res.locals.currentUser = user;
    res.locals.loggingInUser = user;
    res.locals.youtubeStats = youtubeStats;
    res.locals.historicalStats = historicalStats.map(stat => ({
      date: stat.recordedAt.toISOString().split('T')[0],
      subscriberCount: stat.subscriberCount,
      videoCount: stat.videoCount,
      viewCount: stat.viewCount,
    }));

    res.render("profile", { 
      headerName: "Profile", 
      page: 3,
      youtubeStats,
      historicalStats,
    });
  } catch (error) {
    console.error("Error in showProfile:", error.message);
    res.locals.currentUser = await models.User.findByPk(userId);
    res.locals.youtubeStats = { error: error.message };
    res.render("profile", { 
      headerName: "Profile", 
      page: 3,
      youtubeStats: null,
      historicalStats: [],
    });
  }
};

controller.updateProfile = async (req, res) => {
  const userId = req.session.userId;
  const { username, bio, youtubeChannelId } = req.body;

  try {
    const user = await models.User.findByPk(userId);
    if (!user) {
      req.flash('errorMessage', 'User not found.');
      return res.redirect('/profile');
    }

    // Cập nhật thông tin
    user.username = username || user.username;
    user.bio = bio || user.bio;
    user.youtubeChannelId = youtubeChannelId || user.youtubeChannelId;
    
    // Xử lý ảnh hồ sơ nếu có
    if (req.file) {
      user.profilePicture = fs.readFileSync(req.file.path).toString('base64');
      // Xóa file tạm sau khi xử lý
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
  console.log("Topic received:", topic + " Duration:", duration); 

  if (!topic) return res.status(400).json({ success: false, message: "No topic provided" });
  if (chatbot !== "Gemini") return res.status(400).json({ success: false, message: "Chatbot not available" });  
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

module.exports = controller