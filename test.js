const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath); 

function convertWebmToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .on('end', () => {
        console.log('Chuyển đổi thành công!');
        resolve();
      })
      .on('error', (err) => {
        console.error('Lỗi khi chuyển đổi:', err);
        reject(err);
      })
      .run();
  });
}

// Example usage:
const inputWebmFile = './public/src/recording_1746961237619.webm';
const outputMp3File = 'output.mp3';

convertWebmToMp3(inputWebmFile, outputMp3File)
  .then(() => {
    console.log('Conversion successful!');
  })
  .catch((err) => {
    console.error('An error occurred:', err);
  });
