import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// === IMAGE WITH STABILITY ===
export async function generateImage(promptText) {
  const url = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
  const API_KEY = process.env.STABILITY_API_KEY;

  const formData = new FormData();
  formData.append('prompt', JSON.stringify([{ text: promptText }]));
  formData.append('cfg_scale', 7);
  formData.append('clip_guidance_preset', 'FAST_BLUE');
  formData.append('height', 1024);
  formData.append('width', 1024);
  formData.append('samples', 1);
  formData.append('steps', 30);

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  const json = await res.json();
  console.log('Response from stability:', json);
  if (!json.image) throw new Error('No image returned');

  const filename = `image_${Date.now()}.png`;
  const filePath = path.join(__dirname, '..', 'public', 'src', filename);
  const imagePath = `/src/${filename}`;
  fs.writeFileSync(filePath, Buffer.from(json.image, 'base64'));
  return { filename, path: imagePath };
}

// === VIDEO WITH MODELSLAB ===
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkVideoStatus(fetchUrl, projectId, interval = 30000) {
  let attempt = 1;
  while (true) {
    await delay(interval);
    const resultRes = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        key: process.env.MODELSLAB_API_KEY,
      },
      body: JSON.stringify({ id: projectId }),
    });
    const resultData = await resultRes.json();

    console.log(`Attempt ${attempt++}: status = ${resultData.status}`);
    console.log('Modelslab response:', resultData);
    if (resultData.status === 'success') return resultData.output[0];
    else if (resultData.status === 'failed') throw new Error('Video generation failed.');
  }
}

async function downloadVideo(url, outputPath) {
  const response = await fetch(url);
  const fileStream = fs.createWriteStream(outputPath);
  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  console.log(`Video saved to ${outputPath}`);
}

export async function generateVideo(prompt) {
  const payload = {
    key: process.env.MODELSLAB_API_KEY,
    model_id: 'cogvideox',
    prompt,
    negative_prompt: 'low quality, blurry, distorted',
    height: 512,
    width: 512,
    num_frames: 25,
    fps: 10,
    num_inference_steps: 25,
    guidance_scale: 7.5,
    output_type: 'mp4',
  };

  const res = await fetch('https://modelslab.com/api/v6/video/text2video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log('Modelslab response:', data);
  if (data.status !== 'success' && data.status !== 'processing') {
    throw new Error('Failed to start video generation');
  }

  const videoUrl = await checkVideoStatus(data.fetch_result, data.id);
  const filename = `video_${Date.now()}.mp4`;
  const outputPath = path.join(__dirname, '..', 'public', 'src', filename);
  const videoPath = `/src/${filename}`;
  
  await downloadVideo(videoUrl, outputPath);

  return { filename, path: videoPath };
}
