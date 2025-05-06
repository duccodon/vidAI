const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const path = require("path");

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
  const ideaBlocks = content.split(/(?:^|\n)Idea\s*\d*:\s*/).slice(1);
  const ideas = [];

  for (const block of ideaBlocks) {
    const textMatch = block.match(/Text:\s*([\s\S]*?)\nVisual:/);
    const visualMatch = block.match(/Visual:\s*([\s\S]*?)\n/);

    ideas.push({
      text: textMatch ? textMatch[1].trim() : null,
      visual: visualMatch ? visualMatch[1].trim() : null,
    });
  }

  return ideas;
}
