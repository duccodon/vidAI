"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const videos = [
      {
        cloudinaryId: "vidai/videos/vqcxkxmwdbxdegqfnppd",
        title: "Sample AI Intro",
        duration: 120,
        topic: "AI",
        description: "Giới thiệu cơ bản về AI",
        filePath: "https://res.cloudinary.com/dcleoqlak/video/upload/v1746342590/vidai/videos/vqcxkxmwdbxdegqfnppd.mp4",
        userId: 1,
        createdAt: Sequelize.literal("NOW()"),
        updatedAt: Sequelize.literal("NOW()"),
      },
    ];

    await queryInterface.bulkInsert("Videos", videos, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Videos", null, {});
  },
};
