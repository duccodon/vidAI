"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Video, { foreignKey: "userId" });
      User.hasMany(models.VideoStats, { foreignKey: "userId" });
    }
  }

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phonenumber: DataTypes.STRING,
      password: {
        type: DataTypes.STRING,
        allowNull: false,
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
      youtubeVideoId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      youtubeAccessToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      youtubeRefreshToken: {
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