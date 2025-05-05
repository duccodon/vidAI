require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinaryConfig'); // cấu hình cloudinary riêng
const util = require('util');
const controller =  {};
const models = require('../models'); // Import models from Sequelize
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const { Video } = require("../models"); // Đường dẫn models tùy bạn

async function saveVideoToDB(videoData) {
  try {
    const video = await Video.create({
      cloudinaryId: videoData.cloudinaryId,
      filePath: videoData.filePath,
      title: videoData.title || "Untitled",
      duration: videoData.duration || 0,
      topic: videoData.topic,
      description: videoData.description,
      userId: videoData.userId || null
    });

    console.log("Video saved:", video.id);
    return video;
  } catch (err) {
    console.error("Error saving video:", err);
    throw err;
  }
}


// GET /upload/videos
controller.uploadVideo = async (req, res) => {
  try {
    // lấy video từ thư mục public/videos
    const videoDir = path.join(__dirname, '../public/videos');
    const files = await readdir(videoDir);

    const uploadedVideos = [];

    for (const file of files) {
      const filePath = path.join(videoDir, file);
      const fileStats = await stat(filePath);

      // Kiểm tra xem file có phải là video không 
      if (fileStats.isFile() && /\.(mp4|mov|avi)$/i.test(file)) {
        const result = await cloudinary.uploader.upload(filePath, {
          resource_type: 'video',
          folder: 'vidai/videos'
        }); // Upload video lên Cloudinary
        console.log('Video uploaded:', result.secure_url);

        uploadedVideos.push({
          original: file,
          url: result.secure_url,
          cloudinary_id: result.public_id
        });
      }


      //load video to DB here
      
      // await saveVideoToDB({
      //   cloudinaryId: result.public_id,
      //   filePath: result.secure_url,
      //   title: req.body.title,
      //   duration: result.duration ? Math.floor(result.duration) : 0, // Cloudinary trả về thời lượng nếu có
      //   topic: req.body.topic,
      //   description: req.body.description,
      //   userId: req.session.userId
      // });

    }

    res.json({ message: 'Upload thành công', videos: uploadedVideos });




  } catch (error) {
    console.error('Lỗi khi upload video:', error);
    console.log('ENV', process.env.CLOUDINARY_API_KEY);
    console.log('ENV', process.env.CLOUDINARY_API_SECRET);
    console.log('ENV', process.env.CLOUDINARY_CLOUD_NAME);
    res.status(500).json({ error: 'Không thể upload video' });
  }
};

module.exports = controller