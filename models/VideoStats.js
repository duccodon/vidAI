"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class VideoStats extends Model {
      static associate(models) {
        VideoStats.belongsTo(models.User, { foreignKey: 'userId' });
      }
    }
    VideoStats.init(
      {
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        videoId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        channelId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        viewCount: DataTypes.BIGINT,
        likeCount: DataTypes.INTEGER,
        commentCount: DataTypes.INTEGER,
        subscriberCount: DataTypes.INTEGER,
        channelVideoCount: DataTypes.INTEGER,
        channelViewCount: DataTypes.BIGINT,
        recordedAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        modelName: 'VideoStats',
      }
    );
    return VideoStats;
  };