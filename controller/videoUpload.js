require("dotenv").config();
const path = require("path");
const fs = require("fs");
const fsPromises = require('fs').promises;  // Sử dụng fs.promises bất đồng bộ
const cloudinary = require("../config/cloudinaryConfig");
const util = require("util");
const controller = {};
const models = require("../models");
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const { Video } = require("../models");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require('ffprobe-static').path;
const os = require("os");
const { exec } = require("child_process");
const { google } = require("googleapis");
const { Readable } = require('stream');
//const OAuth2 = require("google-auth-library").OAuth2Client;
const OAuth2 = google.auth.OAuth2;

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
ffmpeg.setFfprobePath(ffprobePath);


const { execSync } = require('child_process');



const convertWebmToMp3 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('Input file not found: ' + inputPath));
    }

    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('start', cmd => {
        console.log('▶️ Start:', cmd);
      })
      .on('error', (err) => {
        console.error('❌ Convert error:', err.message);
        reject(err);
      })
      .on('end', () => {
        console.log('✅ Converted to MP3:', outputPath);
        resolve();
      })
      .save(outputPath);
  });
};

const processJsonWebmToMp3 = async (jsonFilePath) => {
  const raw = fs.readFileSync(jsonFilePath, 'utf-8');
  const data = JSON.parse(raw);
  let updated = false;

  for (const item of data) {
    if (item.audioUrl && item.audioUrl.endsWith('.webm')) {
      const webmName = path.basename(item.audioUrl);
      const webmPath = path.join(__dirname, '../public/src', webmName);

      if (!fs.existsSync(webmPath)) {
        console.warn(`⚠️ File not found: ${webmName}`);
        continue;
      }

      const mp3Name = webmName.replace(/\.webm$/, '.mp3');
      const mp3Path = path.join(__dirname, '../public/audios', mp3Name);

      try {
        await convertWebmToMp3(webmPath, mp3Path);
        fs.unlinkSync(webmPath);
        item.audioUrl = `/audios/${mp3Name}`; // cập nhật đúng đường dẫn dùng lại
        updated = true;
        console.log(`✅ Converted and updated: ${webmName} → ${mp3Name}`);
      } catch (err) {
        console.error(`❌ Failed to convert ${webmName}:`, err.message);
      }
    }
  }

  if (updated) {
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('✅ JSON updated and saved.');
  } else {
    console.log('ℹ️ No changes made to JSON.');
  }
};



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
      content: videoData.content || "",
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
  console.log("Video metadata:", metadata.content);
  await saveVideoToDB({
    cloudinaryId: result.public_id,
    filePath: result.secure_url,
    title: metadata.title || path.parse(videoPath).name,
    duration: result.duration ? Math.floor(result.duration) : 0,
    topic: metadata.topic || "Uncategorized",
    description: metadata.description || "",
    userId,
    content: metadata.content || "",
  });

  return result;
};

controller.exportVideo = async (req, res) => {
  const { timeline, audioUrl, audioDuration, volume = 1.0, resolution = '720p', title, description, content, topic } = req.body;

  if (!Array.isArray(timeline) || !audioUrl || !audioDuration) {
    return res.status(400).json({ error: 'Missing timeline, audioUrl or audioDuration' });
  }

  const normalizePath = (url) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  const resolutions = {
    '360p': '640:360',
    '720p': '1280:720',
    '1080p': '1920:1080'
  };
  const scaleOption = resolutions[resolution] || resolutions['720p'];
  const publicDir = path.join(__dirname, '../public');
  const blackImage = '/img/assets/black.jpg';


  const fullTimeline = [];
  let prevEnd = 0;

  for (const item of timeline) {
    const gap = item.start - prevEnd;
    if (gap >= 0.05) {
      fullTimeline.push({ src: blackImage, start: prevEnd, duration: gap });
      console.log('add black frame:', prevEnd, gap);
    }
    fullTimeline.push(item);
    prevEnd = item.start + item.duration;
  }

  const remaining = audioDuration - prevEnd;
  if (remaining >= 0.05) {
    fullTimeline.push({ src: blackImage, start: prevEnd, duration: remaining });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-'));
  const videoListPath = path.join(tempDir, 'input.txt');
  const videoPaths = [];

for (let i = 0; i < fullTimeline.length; i++) {
  const { src, duration, isVideo } = fullTimeline[i];
  const inputPath = path.join(publicDir, normalizePath(src));
  const outVideo = path.join(tempDir, `clip${i}.mp4`);

  await new Promise((resolve, reject) => {
    const ff = ffmpeg().input(inputPath);

    let fadeFilters = [
      `scale=${scaleOption}:force_original_aspect_ratio=decrease`,
      `pad=${scaleOption}:(ow-iw)/2:(oh-ih)/2:color=black`
    ];

    if (duration >= 2) {
      fadeFilters.push(`fade=in:st=0:d=0.5`);
      fadeFilters.push(`fade=out:st=${duration - 0.5}:d=0.5`);
    }

    const filterString = fadeFilters.join(',');

    const outputOpts = [
      `-vf ${filterString}`,
      '-preset ultrafast',
      '-b:v 1000k',
      '-r 25',
      '-pix_fmt yuv420p',
      `-t ${Math.max(0.05, Math.round(duration * 100) / 100)}`,
      '-y'
    ];

    if (isVideo) {
      ff.inputOptions(['-stream_loop 500']);
    } else {
      ff.inputOptions('-loop 1');
    }

    ff.outputOptions(outputOpts)
      .videoCodec('libx264')
      .save(outVideo)
      .on('end', resolve)
      .on('error', reject);
  });

  videoPaths.push(outVideo);
}

  const concatList = videoPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(videoListPath, concatList);

  // Step 2: Create main video with audio
  const mainVideoWithAudio = path.join(publicDir, 'exported', `main_${Date.now()}.mp4`);
  const audioPath = path.join(publicDir, normalizePath(audioUrl));
  const exportCmd = `"${ffmpegPath}" -f concat -safe 0 -i "${videoListPath}" -i "${audioPath}" -filter:a "volume=${volume}" -c:v copy -c:a aac -shortest -y "${mainVideoWithAudio}"`;

  console.log('▶️ Running export:', exportCmd);
  exec(exportCmd, async (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Export failed:', stderr);
      return res.status(500).send('Export failed');
    }

    // Step 3: upload main video to Cloudinary
      try {
        const result = await uploadVideo(mainVideoWithAudio, { title, topic, description, content }, req.session.userId);
        // Clean up
        fs.unlinkSync(mainVideoWithAudio);
        fs.unlinkSync(audioPath);
        fs.rmSync(tempDir, { recursive: true, force: true });

        res.json({ success: true, url: result.secure_url, redirect: '/Video' });
      } catch (uploadError) {
        console.error('❌ Upload failed:', uploadError);
        res.status(500).send('Upload failed');
      }

  });
};


controller.renderVideo = async (req, res) => {
  const { timeline, audioUrl, audioDuration, volume = 1.0 } = req.body;
      if (!Array.isArray(timeline) || !audioUrl || !audioDuration) {
        return res.status(400).json({ error: 'Missing timeline, audioUrl or audioDuration' });
      }
  
      const normalizePath = (url) => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      };
      

      const publicDir = path.join(__dirname, '../public');
      const blackImage = '/img/assets/black.jpg';
      
      // Step 1: Expand timeline with black frames
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
      // Step 2: Create temp .mp4 for each image
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
      const videoListPath = path.join(tempDir, 'input.txt');
      const videoPaths = [];
    
      for (let i = 0; i < fullTimeline.length; i++) {
        const { src, duration, isVideo } = fullTimeline[i];
        const inputPath = path.join(publicDir, normalizePath(src));
        const outVideo = path.join(tempDir, `clip${i}.mp4`);
        const scaleOption = '640:360'; 
        await new Promise((resolve, reject) => {
          const ff = ffmpeg().input(inputPath);
      
          if (isVideo) {
            ff.inputOptions([`-stream_loop 500`])
              .outputOptions([
                `-ss 0`,                 // Nếu muốn trim chính xác: `-ss ${start}`
                `-t ${duration}`,
                `-vf scale=${scaleOption}:force_original_aspect_ratio=decrease,pad=${scaleOption}:(ow-iw)/2:(oh-ih)/2:color=black`,
                '-preset ultrafast',
                '-b:v 500k',
                '-r 15',
                '-pix_fmt yuv420p',
                '-y'
              ])
              .videoCodec('libx264')
              .save(outVideo)
              .on('end', resolve)
              .on('error', reject);
          } else {
            ff
              .inputOptions('-loop 1')
              .outputOptions([
                `-vf scale=${scaleOption}:force_original_aspect_ratio=decrease,pad=${scaleOption}:(ow-iw)/2:(oh-ih)/2:color=black`,
                '-preset ultrafast',
                '-b:v 500k',
                '-r 15',
                '-pix_fmt yuv420p',
                `-t ${duration}`,
                '-y'
              ])
              .videoCodec('libx264')
              .save(outVideo)
              .on('end', resolve)
              .on('error', reject);
          }
        });
      
        videoPaths.push(outVideo);
      }
      
    
      // Step 3: Write input.txt for concat
      const concatList = videoPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(videoListPath, concatList);
    
      // Step 4: Final output path
      const outputPath = path.join(tempDir, `final_${Date.now()}.mp4`);
      const audioPath = path.join(publicDir, normalizePath(audioUrl));
    
      // Step 5: Run concat and add audio
      const cmd = `"${ffmpegPath}" -f concat -safe 0 -i "${videoListPath}" -i "${audioPath}" -filter:a "volume=${volume}" -c:v copy -c:a aac -shortest -y "${outputPath}"`;
      console.log('Running command:', cmd);
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          console.error('❌ FFmpeg concat error:', stderr);
          return res.status(500).send('Render error');
        }
        res.sendFile(outputPath, () => {
          setTimeout(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }, 2000); // delay 1 giây cho chắc ăn
        });      
      });
};

const moment = require('moment');
const { content } = require("googleapis/build/src/apis/content");

controller.videoSync = async (req, res) => {
  const {topic, jsonPath} = req.body;

  // // Bước 1: Ghi đè audioUrl và src

  // console.log('Topic:', topic);
  // console.log('JSON Path:', jsonPath);
  // console.log('Đường dẫn JSON:', path.join(__dirname, '../public', jsonPath));
   const getFileName = (value) => {
    if (!value) return value;
    try {
      const url = new URL(value, 'http://localhost'); // fallback cho relative path
      return path.basename(url.pathname);
    } catch {
      return path.basename(value);
    }
  };

  let timelineData = [];
  try {
    if (typeof jsonPath === 'string' && (jsonPath.trim().startsWith('[') || jsonPath.trim().startsWith('{'))) {
      // ✅ Trường hợp là chuỗi JSON stringify
      console.log('📄 Nhận JSON dạng chuỗi từ body');
      timelineData = JSON.parse(jsonPath);
    } else if (typeof jsonPath === 'string') {
      // ✅ Trường hợp là đường dẫn đến file
      const absolutePath = path.join(__dirname, '../public', jsonPath);
      console.log('📁 Đọc JSON từ file:', absolutePath);

      const raw = fs.readFileSync(absolutePath, 'utf-8');
      timelineData = JSON.parse(raw);
    } else {
      throw new Error('jsonPath không hợp lệ: phải là chuỗi JSON hoặc đường dẫn');
    }


    // Rút gọn tên file cho audioUrl và src
    timelineData = timelineData.map(item => ({
      ...item,
      audioUrl: getFileName(item.audioUrl),
      src: getFileName(item.src)
    }));
  } catch (e) {
    console.warn('⚠ Không đọc được JSON:', e.message);
    return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ' });
  }

  // Lấy danh sách các audioUrl từ timeline
  const audioUrls = timelineData.map(item => item.audioUrl);
  const audioPaths = audioUrls.map(url => path.join(__dirname, '../public', 'audios', url));

  console.log('Danh sách audioUrls:', audioUrls);
  console.log('Danh sách audioPaths:', audioPaths);
  // Kiểm tra nếu chỉ có audio, không có video
  if (audioUrls.length > 0) {
    const outputAudioPath = path.join(__dirname, '../public/audios', `merged_audio_${Date.now()}.mp3`); //THAY ĐỔI ĐƯỜNG DẪN NẾU CẦN
    const cmd = `"${ffmpegPath}" -i "concat:${audioPaths.join('|')}" -c:a libmp3lame -b:a 192k -y "${outputAudioPath}"`;

    console.log('Running command:', cmd);

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ FFmpeg concat error:', stderr);
        return res.status(500).send('Render error');
      }

      console.log('Audio merge completed');
      // Trả về audio đã ghép
      res.render("video-sync", {
        headerName: "Đồng bộ video",
        page: 6,
        layout: "layout",
        title: "Đồng bộ video",
        metadata: {
          audioUrl: `/audios/${path.basename(outputAudioPath)}`, // Gán đường dẫn của audio đã merge vào audioUrl, đường dẫn đầy đủ, thay đổi nếu cần, sử dụng trong frontend
          title: '',
          description:'',
          topic: topic,
          timeline: timelineData
        }
      });

      // Sau khi render xong, xóa các file âm thanh nhỏ đã merge
      //audioPaths.forEach(filePath => fs.unlinkSync(filePath));  // Xóa từng file audio nhỏ (UNCOMMENT khi đã có JSON thực)
    });
  } else {
    return res.status(400).json({ error: 'No audio files to merge' });
  }
};


controller.authYouTube = async (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });
  console.log("Url: ", url);
  res.redirect(url);
};

controller.handleYouTubeCallback = async (req, res) => {
  const { code } = req.query;
  console.log("Code: ", code);
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("Tokens: ", tokens);
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
          body: fsPromises.createReadStream(thumbnailFile),
        },
      });
    }

    await fsPromises.rm(tempDir, { recursive: true, force: true });

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
  if (!res.ok) throw new Error(`Download failed: ${url}`);
  const fileStream = fs.createWriteStream(dest);
  const nodeStream = Readable.fromWeb(res.body); // Convert web stream to Node.js stream
  await new Promise((resolve, reject) => {
    nodeStream.pipe(fileStream);
    nodeStream.on('error', reject);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

controller.mergeAudio = async (req, res) => {
  const { audioUrls } = req.body; // Dữ liệu gửi từ frontend, mảng các audio URLs
  
  if (!audioUrls || audioUrls.length === 0) {
    return res.status(400).json({ error: 'Không có audio để ghép' });
  }

  // Tính tổng duration của tất cả các audio
  let totalDuration = 0;
  const inputFileListPath = path.join(__dirname, 'input-list.txt');
  const fileListContent = audioUrls.map(url => {
    const audioPath = path.join(__dirname, 'public', 'audios', url);
    console.log('Đường dẫn audio:', audioPath);
    const stats = fs.statSync(audioPath);
    totalDuration += Math.floor(stats.size / 1024 / 1024); // Đây chỉ là ví dụ, bạn có thể dùng cách tính đúng hơn cho thời gian âm thanh
    return `file '${audioPath}'`; // Lưu đường dẫn của audio vào file danh sách
  }).join('\n');

  // Viết danh sách vào file
  fs.writeFileSync(inputFileListPath, fileListContent);

  // Tạo tên file mới cho audio đã merge theo thời gian hiện tại và tổng duration
  const timeNow = moment().format('HHmmss');  // Lấy thời gian hiện tại theo định dạng HHmmss
  const outputFileName = `audio_${timeNow}_${totalDuration}.mp3`;
  const outputPath = path.join(__dirname, 'public', 'audios', outputFileName);

  // Dùng FFmpeg để ghép các audio lại
  ffmpeg()
    .input(inputFileListPath)
    .inputOptions('-f concat', '-safe 0') // Các option để ghép các file audio
    .output(outputPath)
    .on('end', () => {
      console.log('Audio merge completed');
      
      // Xóa các file âm thanh nhỏ sau khi merge xong
      audioUrls.forEach(url => {
        const audioPath = path.join(__dirname, 'public', 'audios', url);
        fs.unlinkSync(audioPath);  // Xóa từng file audio
      });
      
      // Xóa file danh sách sau khi hoàn thành
      fs.unlinkSync(inputFileListPath);

      // Trả về tên file đã merge
      res.json({ success: true, fileName: outputFileName });
    })
    .on('error', (err) => {
      console.error('Error merging audio:', err);
      fs.unlinkSync(inputFileListPath); // Xóa file danh sách nếu có lỗi
      res.status(500).json({ error: 'Lỗi khi ghép audio' });
    })
    .run();
};

controller.deleteVideo = async (req, res) => {
  const { videoId } = req.params;
  console.log("Video ID:", videoId);
  if (!videoId) {
    return res.status(400).json({ success: false, message: "Video ID is required" });
  }
  const userId = req.session.userId;

  try {
    const video = await models.Video.findByPk(videoId);
    if (!video || video.userId !== userId) {
      return res.status(404).json({ success: false, message: "Video not found or unauthorized" });
    }

    // Xóa video trên Cloudinary
    await cloudinary.uploader.destroy(video.cloudinaryId, { resource_type: "video" });
    console.log("Video deleted from Cloudinary:", video.cloudinaryId);
    // Xóa video trong cơ sở dữ liệu
    await models.Video.destroy({ where: { id: videoId } });
    console.log("Video deleted from database:", videoId);
    return res.json({ success: true, message: "Video deleted successfully" });
  } catch (err) {
    console.error("Error deleting video:", err.message);
    res.status(500).json({ success: false, message: "Error deleting video" });
  }

}
module.exports = controller;