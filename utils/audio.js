const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const AWS = require("aws-sdk");
const gTTS = require('gtts');

async function generateAudioScript(script) {
  const segments = parseScriptWithIdeas(script);
  //const client = new textToSpeech.TextToSpeechClient();

  console.log("Parsed segments:", segments);
  // Create a directory to store audio files
  // const dirPath = path.join(__dirname, '../public/audios');
  // if (!fs.existsSync(dirPath)) {
  //   fs.mkdirSync(dirPath);
  // }

  // for (const segment of segments) {
  //   for (const idea of segment.ideas) {
  //     const text = idea.text;

  //     if (text) {
  //       const request = {
  //         input: { text },
  //         voice: { languageCode: "vi-VN", name: "vi-VN-Standard-C" },
  //         audioConfig: { audioEncoding: "MP3" },
  //       };

  //       try {
  //         const [response] = await client.synthesizeSpeech(request);
  //         const filePath = path.join(dirPath, `audio_${segment.start}_${segment.end}.mp3`);
  //         fs.writeFileSync(filePath, response.audioContent, "binary");

  //         console.log(`Audio file for segment ${segment.title} saved to ${filePath}`);
  //       } catch (error) {
  //         console.error("Error during text-to-speech:", error);
  //       }
  //     }
  //   }
  // }
}

function parseScriptWithIdeas(script) {
  const blockRegex =
    /\*\*\s*\[(.+?):\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\]\s*\*\*:\s*([\s\S]*?)(?=\n\*\*|\*\*|$)/g;

  const segments = [];
  let match;

  while ((match = blockRegex.exec(script)) !== null) {
    const [_, title, start, end, rawContent] = match;

    const ideas = extractIdeas(rawContent.trim());

    segments.push({
      title: title.trim(),
      start: start.trim(),
      end: end.trim(),
      ideas,
    });
  }

  return segments;
}

function extractIdeas(content) {
  // Remove trailing content that isn't part of an Idea block (e.g., "(Nhạc nền...)")
  const cleanedContent = content.split(/^\(/m)[0].trim();

  // Split by "Idea" headers
  const ideaBlocks = cleanedContent.split(/(?:^|\n)Idea\s*\d*:\s*/).slice(1);
  const ideas = [];

  for (const block of ideaBlocks) {
    // Match Text: (everything until Visual: or end)
    const textMatch = block.match(/Text:\s*([\s\S]*?)(?:\nVisual:|$)/);
    // Match Visual: (everything until newline or end)
    const visualMatch = block.match(/Visual:\s*([\s\S]*?)(?:\n|$)/);

    ideas.push({
      text: textMatch ? textMatch[1].trim() : null,
      visual: visualMatch ? visualMatch[1].trim() : null,
    });
  }

  return ideas;
}

//young adult lady XfNU2rGpBa01ckF309OY
//trung nien vietnam nam 3VnrjnYrskPMDsapTr8X

async function generateElevenLabsAudio(
  text,
  voiceId = "XfNU2rGpBa01ckF309OY",
  outputFile = "output.mp3"
) {
  const apiKey = process.env.ELEVENLABS_API_KEY; 

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: "eleven_multilingual_v2", // eleven_flash_v2_5 cho tieng viet
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
        },
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    fs.writeFileSync(outputFile, response.data);
    console.log("Audio saved to", outputFile);
  } catch (error) {
    console.error(
      "ElevenLabs error:",
      error.response?.data || error.message
    );
  }
}

//generateElevenLabsAudio("hi there, im your AI assistant from ElevenLabs");

//aws chi dung cho tieng anh
AWS.config.update({
  region: "ap-southeast-1", // Singapore hoặc us-east-1
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const polly = new AWS.Polly();

async function generateAmazonPollyAudio(text, voiceId) {
  const params = {
    Text: text,
    OutputFormat: "mp3",
    VoiceId: voiceId, 
    LanguageCode: "en-US", 
  };

  try {
    const data = await polly.synthesizeSpeech(params).promise();
    fs.writeFileSync("output_polly.mp3", data.AudioStream);
    console.log("✅ Audio saved as output_polly.mp3");
  } catch (err) {
    console.error("❌ Polly error:", err.message);
  }
}

// generateAmazonPollyAudio("Chào Đức đây là amazon polly, chương trình chạy miễn phí 12 tháng", "Joanna");


//gtts dung tieng viet va tieng anh nhung khong co nhieu giong noi
// const text = 'Chào bạn, đây là video khoa học tự động!';

// // Chọn ngôn ngữ (ví dụ: 'vi' cho tiếng Việt)
// const language = 'vi';

// // Tạo đối tượng gTTS
// const gtts = new gTTS(text, language);

// // Lưu file âm thanh
// gtts.save('output.mp3', (err, result) => {
//   if (err) {
//     console.log('Có lỗi khi tạo file âm thanh:', err);
//   } else {
//     console.log('Đã tạo file âm thanh thành công: output.mp3');
//   }
// });

module.exports = { generateAudioScript, parseScriptWithIdeas, extractIdeas };
