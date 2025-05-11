const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const AWS = require("aws-sdk");
const gTTS = require('gtts');

const audioOutputDir = path.join(__dirname, "../public/audios");

async function generateAudioScript(engine, voiceId, script) {
  const segments = parseScriptWithIdeas(script);
  const audioResults = [];
  console.log(JSON.stringify(parseScriptWithIdeas(script), null, 2));

  if (!fs.existsSync(audioOutputDir)) {
    fs.mkdirSync(audioOutputDir, { recursive: true });
  }

  for (const segment of segments) {
    const segmentAudios = {
      segmentTitle: segment.title,
      start: segment.start,
      end: segment.end,
      ideas: [],
    };

    for (let i = 0; i < segment.ideas.length; i++) {
      const idea = segment.ideas[i];
      const text = idea.text;
      if (!text) continue;

      const filename = `audio_${segment.start.replace(":", "-")}_${segment.end.replace(":", "-")}_${i}.mp3`;
      const outputFile = path.join(audioOutputDir, filename);
      const audioPath = `/audios/${filename}`; // relative path to return

      try {
        if (engine === "elevenlabs") {
          await generateElevenLabsAudio(text, voiceId, outputFile);
        } else if (engine === "amazonpolly") {
          await generateAmazonPollyAudio(text, voiceId, outputFile);
        } else if (engine === "gtts") {
          await generateGTTSAudio(text, voiceId, outputFile);
        } else {
          console.err(`Engine '${engine}' not supported, ${voiceId}.`);
        }

        segmentAudios.ideas.push({ text, audioPath, visual: idea.visual });
      } catch (err) {
        console.error(`Error generating audio for segment ${segment.title}, idea ${i}:`, err);
      }
    }

    audioResults.push(segmentAudios);
  }

  return audioResults;
}


function parseScriptWithIdeas(script) {
  const blockRegex =
    /\*\*\s*\[(.+?)\:\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\]\s*\*\*\s*([\s\S]*?)(?=\n\*\*|\*\*|$)/g;

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
  const ideaBlocks = content.split(/(?:^|\n)Idea\s*\d*:\s*/).slice(1);
  const ideas = [];

  for (const block of ideaBlocks) {
    const textMatch = block.match(/Text:\s*([\s\S]*?)\s*Visual:/);
    const visualMatch = block.match(/Visual:\s*([\s\S]*?)(?:\n|$)/);

    ideas.push({
      text: textMatch ? textMatch[1].trim() : null,
      visual: visualMatch ? visualMatch[1].trim() : null,
    });
  }

  return ideas;
}

//confident male dXtC3XhB9GtPusIpNtQx
//friendly young adult female XfNU2rGpBa01ckF309OY
//trung nien vietnam nam 3VnrjnYrskPMDsapTr8X
//gai da nang young middle age foH7s9fX31wFFH2yqrFa

async function generateElevenLabsAudio(
  text,
  voiceId,
  outputFile
) {
  const apiKey = process.env.ELEVENLABS_API_KEY; 
  const voiceModelMap = {
    dXtC3XhB9GtPusIpNtQx: "eleven_multilingual_v2", // Hale
    XfNU2rGpBa01ckF309OY: "eleven_multilingual_v2", // Nichalia

    "3VnrjnYrskPMDsapTr8X": "eleven_flash_v2_5", // DangTungDuy 
    foH7s9fX31wFFH2yqrFa: "eleven_flash_v2_5",     // Huyen
  };

  const modelId = voiceModelMap[voiceId] || "eleven_flash_v2_5";
  console.log("Using model ID:", voiceId + " " + modelId);

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: modelId, // eleven_flash_v2_5 cho tieng viet, eleven_multilingual_v2 cho tieng anh
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

//aws chi dung cho tieng anh
// Cấu hình thông tin xác thực
AWS.config.update({
  region: "ap-southeast-1", // Singapore hoặc us-east-1
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const polly = new AWS.Polly();

async function generateAmazonPollyAudio(text, voiceId, outputFile) {
  const amazonVoiceModelMap = {
    Joanna: "en-US", // en
    Matthew: "en-US", // en
    Jihye: "ko-KR", // korean
    Daniel: "de-DE", // german
  };

  const langcode = amazonVoiceModelMap[voiceId] || "en-US";

  const params = {
    Text: text,
    OutputFormat: "mp3",
    VoiceId: voiceId, 
    LanguageCode: langcode,
  };

  try {
    const data = await polly.synthesizeSpeech(params).promise();
    fs.writeFileSync(outputFile, data.AudioStream);
    console.log("Audio saved as", outputFile);
  } catch (err) {
    console.error("Polly error:", err.message);
  }
}


//gtts dung tieng viet va tieng anh nhung khong co nhieu giong noi
async function generateGTTSAudio(text, voiceId, outputFile) {
  return new Promise((resolve, reject) => {
    const gtts = new gTTS(text, voiceId);

    gtts.save(outputFile, function (err, result) {
      if (err) {
        console.error("gTTS error:", err.message);
        return reject(err);
      }

      console.log("Audio saved as", outputFile);
      resolve();
    });
  });
}

module.exports = { generateAudioScript, parseScriptWithIdeas, extractIdeas };
