const controller = {};
const models = require("../models");
const crypto = require("crypto");
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");

controller.addUser = async (req, res) => {
  const { email, phonenumber, username, password } = req.body;
  try {
    await models.User.create({
      email,
      phonenumber,
      username,
      password,
    });
    res.redirect("/login");
  } catch (error) {
    console.error(error);
  }
};


controller.verifyEmail = async (req, res) => {
  const { token } = req.query; // Token sent in the query params

  try {
    // Find the user with the matching verification token
    const user = await models.User.findOne({ where: { verificationToken: token } });

    if (!user) {
      req.flash('errorMessage', 'Invalid or expired verification token.');
      return res.redirect('/Login');
    }

    user.isVerified = true;
    user.verificationToken = null; 
    await user.save();

    req.flash('errorMessage', 'Your email has been verified successfully. You can now log in.');
    return res.redirect('/Login');
  } catch (error) {
    console.error(error);
    return res.render("login", {
      layout: "account",
      title: "Login",
      errorMessage: "An unexpected error occurred. Please try again.",
    });
  }
};

controller.verifyResetPass = async(req, res) => {
  const { token } = req.query;
  const { password } = req.body;

  try {
    // Find the user with the matching verification token
    const user = await models.User.findOne({ where: { resetToken: token } });

    if (!user) {
      req.flash('errorMessage', 'Invalid or expired reset token.');
      return res.redirect('/Login/ResetPass');
    }

    const hashedResetPassword = await bcrypt.hash(password, 10);

    user.resetToken = null;
    user.password = hashedResetPassword; 
    await user.save();

    req.flash('errorMessage', 'Your password has been reset successfully. You can now log in.');
    return res.redirect('/Login');
  } catch (error) {
    console.error(error);
    return res.render("login", {
      layout: "account",
      title: "Login",
      errorMessage: "An unexpected error occurred. Please try again.",
    });
  }
}


const sendResetPassEmail = async(email, resetToken) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or any email service
    auth: {
      user: 'ducnguyentemp@gmail.com', // replace with your email
      pass: 'kcvs jqcq gfxr kjon',   // replace with your email password
    },
  });

  const verificationLink = `https://final-ulti-threads.onrender.com/Login/VerifyReset?token=${resetToken}`;

  const mailOptions = {
    from: 'ducnguyentemp@gmail.com',
    to: email,
    subject: 'Reset Password Link',
    html: `<p>Please click the link below to reset your password:</p><p><a href="https://final-ulti-threads.onrender.com/Login/VerifyReset?token=${resetToken}">Click here to reset your password</a></p><p>The reset link is: https://final-ulti-threads.onrender.com/Login/VerifyReset?token=${resetToken}</p>`,
  };

  await transporter.sendMail(mailOptions);
}

controller.resetPass = async(req, res) => {
  const { usernameOrEmail } = req.body;

  try {
    let user;
    if (usernameOrEmail.includes('@')) {
      user = await models.User.findOne({
        where: {
          email: usernameOrEmail,
        }
      });
    }else {
      user = await models.User.findOne({
        where: {
          username: usernameOrEmail,
        }
      });
    }

    if (!user) {
      req.flash('errorMessage', 'Invalid username or email. Please try again');
      res.redirect('/Login/ResetPass');
    }else {
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetToken = resetToken;
      await user.save();

      await sendResetPassEmail(user.email, resetToken);
      req.flash('errorMessage', 'Reset link has been sent successfully.');
      res.redirect('/Login/ResetPass');
    }
  }catch(error){
    console.error(error);
  }
}

module.exports = controller;