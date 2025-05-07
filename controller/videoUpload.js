require("dotenv").config();
const path = require("path");
const fs = require("fs").promises;
const cloudinary = require("../config/cloudinaryConfig");
const util = require("util");
const controller = {};
const models = require("../models");
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const { Video } = require("../models");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const os = require("os");
const { exec } = require("child_process");
const { google } = require("googleapis");
const OAuth2 = require("google-auth-library").OAuth2Client;

// Cấu hình OAuth2 cho YouTube
const oauth2Client = new OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
);

// Danh mục video YouTube
const categoryIds = {
  Entertainment: 24,
  Education: 27,
  ScienceTechnology: 28,
};

ffmpeg.setFfmpegPath(ffmpegPath);

async function saveVideoToDB(videoData) {
  try {
    const video = await Video.create({
      cloudinaryId: videoData.cloudinaryId,
      filePath: videoData.filePath,
      title: videoData.title || "Untitled",
      duration: videoData.duration || 0,
      topic: videoData.topic,
      description: videoData.description,
      userId: videoData.userId || null,
    });
    console.log("Video saved:", video.id);
    return video;
  } catch (err) {
    console.error("Error saving video:", err);
    throw err;
  }
}

const uploadVideo = async (videoPath, metadata = {}, userId = null) => {
  if (!fs.existsSync(videoPath)) {
    throw new Error("Video file does not exist: " + videoPath);
  }

  const result = await cloudinary.uploader.upload(videoPath, {
    resource_type: "video",
    folder: "vidai/videos",
  });

  console.log("✅ Video uploaded to Cloudinary:", result.secure_url);

  await saveVideoToDB({
    cloudinaryId: result.public_id,
    filePath: result.secure_url,
    title: metadata.title || path.parse(videoPath).name,
    duration: result.duration ? Math.floor(result.duration) : 0,
    topic: metadata.topic || "Uncategorized",
    description: metadata.description || "",
    userId,
  });

  return result;
};

controller.exportVideo = async (req, res) => {
  const { timeline, audioUrl, audioDuration, resolution = "720p", title, description, topic } = req.body;
  if (!Array.isArray(timeline) || !audioUrl || !audioDuration) {
    return res.status(400).json({ error: "Missing timeline, audioUrl or audioDuration" });
  }

  console.log("Timeline:", timeline);
  console.log("Audio URL:", audioUrl);
  console.log("Audio Duration:", audioDuration);
  console.log("Resolution:", resolution);
  const normalizePath = (url) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  const resolutions = {
    "360p": "640:360",
    "720p": "1280:720",
    "1080p": "1920:1080",
  };
  const scaleOption = resolutions[resolution] || resolutions["720p"];
  const publicDir = path.join(__dirname, "../public");
  const blackImage = "/img/assets/black.jpg";
  const fullTimeline = [];

  let prevEnd = 0;
  for (const item of timeline) {
    const gap = item.start - prevEnd;
    if (gap >= 0.05) {
      fullTimeline.push({ src: blackImage, start: prevEnd, duration: gap });
    }
    fullTimeline.push(item);
    prevEnd = item.start + item.duration;
  }

  const remaining = audioDuration - prevEnd;
  if (remaining >= 0.05) {
    fullTimeline.push({ src: blackImage, start: prevEnd, duration: remaining });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-"));
  const videoListPath = path.join(tempDir, "input.txt");
  const videoPaths = [];

  for (let i = 0; i < fullTimeline.length; i++) {
    const { src, duration } = fullTimeline[i];
    const inputImage = path.join(publicDir, normalizePath(src));
    const outVideo = path.join(tempDir, `clip${i}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputImage)
        .inputOptions("-loop 1")
        .outputOptions([
          `-vf scale=${scaleOption}`,
          "-preset ultrafast",
          "-b:v 1000k",
          "-r 25",
          "-pix_fmt yuv420p",
          `-t ${Math.max(0.05, Math.round(duration * 100) / 100)}`,
          "-y",
        ])
        .videoCodec("libx264")
        .save(outVideo)
        .on("end", resolve)
        .on("error", reject);
    });

    videoPaths.push(outVideo);
  }

  const concatList = videoPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(videoListPath, concatList);

  const outputPath = path.join(publicDir, "exported", `video_${Date.now()}.mp4`);
  const audioPath = path.join(publicDir, normalizePath(audioUrl));

  const cmd = `"${ffmpegPath}" -f concat -safe 0 -i "${videoListPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest -y "${outputPath}"`;
  console.log("Running export command:", cmd);
  exec(cmd, async (err, stdout, stderr) => {
    if (err) {
      console.error("❌ FFmpeg export error:", stderr);
      return res.status(500).send("Export failed");
    }

    try {
      const result = await uploadVideo(outputPath, { title, topic, description }, req.session.userId);

      fs.unlink(outputPath, (err) => {
        if (err) console.warn("⚠️ Không thể xóa file sau upload:", err.message);
        else console.log("🧹 File đã được xóa sau khi upload:", outputPath);
      });

      res.json({ success: true, url: result.secure_url, redirect: "/Video" });
    } catch (uploadError) {
      console.error("❌ Upload error:", uploadError);
      res.status(500).send("Upload failed");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
};

controller.renderVideo = async (req, res) => {
  const { timeline, audioUrl, audioDuration } = req.body;
  if (!Array.isArray(timeline) || !audioUrl || !audioDuration) {
    return res.status(400).json({ error: "Missing timeline, audioUrl or audioDuration" });
  }

  const normalizePath = (url) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  const publicDir = path.join(__dirname, "../public");
  const blackImage = "/img/assets/black.jpg";

  const fullTimeline = [];
  let prevEnd = 0;
  for (const item of timeline) {
    const gap = item.start - prevEnd;
    if (gap >= 0.05) {
      fullTimeline.push({ src: blackImage, start: prevEnd, duration: gap });
    }
    fullTimeline.push(item);
    prevEnd = item.start + item.duration;
  }

  const remaining = audioDuration - prevEnd;
  if (remaining >= 0.05) {
    fullTimeline.push({ src: blackImage, start: prevEnd, duration: remaining });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-"));
  const videoListPath = path.join(tempDir, "input.txt");
  const videoPaths = [];

  for (let i = 0; i < fullTimeline.length; i++) {
    const { src, duration } = fullTimeline[i];
    const inputImage = path.join(publicDir, normalizePath(src));
    const outVideo = path.join(tempDir, `clip${i}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputImage)
        .inputOptions("-loop 1")
        .outputOptions([
          "-vf scale=640:360",
          "-preset ultrafast",
          "-b:v 500k",
          "-r 15",
          "-pix_fmt yuv420p",
          "-t " + duration,
          "-y",
        ])
        .videoCodec("libx264")
        .save(outVideo)
        .on("end", resolve)
        .on("error", reject);
    });

    videoPaths.push(outVideo);
  }

  const concatList = videoPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(videoListPath, concatList);

  const outputPath = path.join(tempDir, `final_${Date.now()}.mp4`);
  const audioPath = path.join(publicDir, normalizePath(audioUrl));

  const cmd = `"${ffmpegPath}" -f concat -safe 0 -i "${videoListPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest -y "${outputPath}"`;
  console.log("Running command:", cmd);
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ FFmpeg concat error:", stderr);
      return res.status(500).send("Render error");
    }
    res.sendFile(outputPath, () => {
      setTimeout(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }, 2000);
    });
  });
};

controller.videoSync = async (req, res) => {
  const { audioUrl, title, description, topic, images } = req.body;

  let imageList = [];
  try {
    imageList = typeof images === "string" ? JSON.parse(images) : images;
  } catch (e) {
    console.warn("⚠ Không parse được images:", images);
  }

  res.render("video-sync", {
    headerName: "Đồng bộ video",
    page: 6,
    layout: "layout",
    title: "Đồng bộ video",
    metadata: {
      audioUrl,
      title,
      description,
      topic,
      images: imageList,
    },
  });
};

controller.authYouTube = async (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });
  res.redirect(url);
};

controller.handleYouTubeCallback = async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    const userId = req.session.userId;
    await models.User.update(
      {
        youtubeAccessToken: tokens.access_token,
        youtubeRefreshToken: tokens.refresh_token,
      },
      { where: { id: userId } }
    );
    req.session.youtubeTokens = tokens;
    res.redirect("/Video");
  } catch (err) {
    console.error("Error handling YouTube callback:", err.message);
    res.status(500).send("Authentication failed");
  }
};

controller.uploadToYouTube = async (req, res) => {
  const { videoId, title, description, privacyStatus, thumbnailUrl } = req.body;
  const userId = req.session.userId;

  try {
    const video = await models.Video.findByPk(videoId);
    if (!video || video.userId !== userId) {
      return res.status(404).json({ success: false, message: "Video not found or unauthorized" });
    }

    const user = await models.User.findByPk(userId);
    if (!user.youtubeAccessToken) {
      return res.json({ success: false, message: "YouTube authentication required", redirect: "/Video/auth/youtube" });
    }

    oauth2Client.setCredentials({
      access_token: user.youtubeAccessToken,
      refresh_token: user.youtubeRefreshToken,
    });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "youtube-"));
    const videoFile = path.join(tempDir, `video_${Date.now()}.mp4`);
    await download(video.filePath, videoFile);

    let thumbnailFile;
    if (thumbnailUrl) {
      thumbnailFile = path.join(tempDir, `thumb_${Date.now()}.png`);
      await download(thumbnailUrl, thumbnailFile);
    }

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: title || video.title,
          description: description || video.description || "",
          tags: ["vidai", video.topic || "video"],
          categoryId: categoryIds.Education, // Có thể thay đổi theo topic
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: {
          privacyStatus: privacyStatus || "public",
        },
      },
      media: {
        body: fs.createReadStream(videoFile),
      },
    });

    if (thumbnailFile) {
      await youtube.thumbnails.set({
        videoId: response.data.id,
        media: {
          body: fs.createReadStream(thumbnailFile),
        },
      });
    }

    await fs.rm(tempDir, { recursive: true, force: true });

    // Lưu youtubeVideoId vào Video để theo dõi
    await models.Video.update(
      { youtubeVideoId: response.data.id },
      { where: { id: videoId } }
    );

    return res.json({
      success: true,
      videoId: response.data.id,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    });
  } catch (err) {
    console.error("Error uploading to YouTube:", err.message);
    return res.status(500).json({ success: false, message: "Error uploading to YouTube" });
  }
};

// Hàm download (tái sử dụng từ index.js)
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed: " + url);
  const fileStream = fs.createWriteStream(dest);
  await new Promise((r, e) => {
    res.body.pipe(fileStream);
    res.body.on("error", e);
    fileStream.on("finish", r);
  });
}

module.exports = controller;