"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class ChannelStats extends Model {
      static associate(models) {
        ChannelStats.belongsTo(models.User, { foreignKey: 'userId' });
      }
    }
    ChannelStats.init(
      {
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        subscriberCount: DataTypes.INTEGER,
        videoCount: DataTypes.INTEGER,
        viewCount: DataTypes.BIGINT,
        recordedAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        modelName: 'ChannelStats',
      }
    );
    return ChannelStats;
  };