"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Video extends Model {
    static associate(models) {
      Video.belongsTo(models.User, { foreignKey: "userId" }); // Nếu bạn muốn liên kết video với user
    }
  }

  Video.init(
    {
      cloudinaryId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      duration: {
        type: DataTypes.INTEGER, // Thời lượng tính bằng giây
        allowNull: false,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      filePath: {
        type: DataTypes.STRING,
        allowNull: false, // Đường dẫn đến video (ví dụ: 'uploads/myvideo.mp4')
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true
      },
    },
    {
      sequelize,
      modelName: "Video",
    }
  );

  return Video;
};
