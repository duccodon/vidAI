// models/User.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // define association here
      User.hasMany(models.Video, { foreignKey: "user_id" });
    }
  }

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        unique: true,  // Đảm bảo username là duy nhất
        allowNull: false  // Đảm bảo username không được để trống
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      phonenumber: DataTypes.STRING,
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      bio: DataTypes.TEXT,
      profile_picture: DataTypes.TEXT,
      verificationToken: {   
        type: DataTypes.STRING,
        allowNull: true,      
      },
      resetToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isVerified: {           
        type: DataTypes.BOOLEAN,
        defaultValue: false,  
      },
      youtubeChannelId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
    }
  );

  return User;
};