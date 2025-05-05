const controller =  {};
const models = require('../models'); 

const bcrypt = require('bcrypt'); // Ensure password security
const { Op, where } = require('sequelize');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { fn, col, literal } = require("sequelize");


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

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  res.render("profile", { headerName: "Profile", page: 3 });
};

module.exports = controller