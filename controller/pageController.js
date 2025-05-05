const controller =  {};
const models = require('../models'); 

const bcrypt = require('bcrypt'); // Ensure password security
const { Op, where } = require('sequelize');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { fn, col, literal } = require("sequelize");

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

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  res.render("profile", { headerName: "Profile", page: 3 });
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