const path = require('path');
const fs = require('fs');
const multer = require('multer');

const recordingsDir = path.join(__dirname, '../public/src');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// Multer setup để lưu file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `recording_${timestamp}${ext}`);
  }
});
const upload = multer({ storage }).single('audio');

function uploadRecording(req, res) {
  upload(req, res, (err) => {
    if (err) {
      console.error("Error uploading audio:", err);
      return res.status(500).json({ error: 'Failed to upload recording' });
    }

    console.log("Recording saved at:", req.file.path);
    return res.json({ success: true, message: 'Upload successful', path: `/src/${req.file.filename}` });
  });
}

module.exports = {
  uploadRecording
};
