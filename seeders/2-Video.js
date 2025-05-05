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
      {
        cloudinaryId: "vidai/videos/ri9inn9kjyfsbhq7w8b7",
        title: "Data Science Basics",
        duration: 240,
        topic: "Data Science",
        description: "Tổng quan về Khoa học dữ liệu",
        filePath: "https://res.cloudinary.com/dcleoqlak/video/upload/v1746342599/vidai/videos/ri9inn9kjyfsbhq7w8b7.mp4",
        userId: 1,
        createdAt: Sequelize.literal("NOW()"),
        updatedAt: Sequelize.literal("NOW()"),
      },
      {
        cloudinaryId: "vidai/videos/pkjp8r1k3qwboc6bmz2j",
        title: "Data Science Basics",
        duration: 240,
        topic: "Data Science",
        description: "Tổng quan về Khoa học dữ liệu",
        filePath: "https://res.cloudinary.com/dcleoqlak/video/upload/v1746342609/vidai/videos/pkjp8r1k3qwboc6bmz2j.mp4",
        userId: 1,
        createdAt: Sequelize.literal("NOW()"),
        updatedAt: Sequelize.literal("NOW()"),
      },
      {
        cloudinaryId: "vidai/videos/qqvab6e3lz1ibxbfn04r",
        title: "Data Science Basics",
        duration: 240,
        topic: "Data Science",
        description: "Tổng quan về Khoa học dữ liệu",
        filePath: "https://res.cloudinary.com/dcleoqlak/video/upload/v1746342615/vidai/videos/qqvab6e3lz1ibxbfn04r.mp4",
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
