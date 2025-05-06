const axios = require("axios"); //crawl Wikipedia, openAI gen script
const xml2js = require("xml2js"); // crawl PubMed
const cheerio = require("cheerio"); // crawl Nature

const OpenAI = require("openai"); // OpenAI gen script
const Groq = require("groq-sdk"); // Groq gen script

const dotenv = require("dotenv");
dotenv.config();

function convertTime(str) {
  const minutes = parseInt(str); // Extract number from "X min" or "XX min"
  return minutes < 10 ? `0${minutes}:00` : `${minutes}:00`;
}
async function generateScript(
  duration,
  topic,
  chatbot,
  writingStyles,
  rawText
) {
  const prompt = `
      You are a scientific scriptwriter for educational videos.
  
      Using ONLY the following content from trusted sources (Wikipedia, PubMed, Nature), create a clear and engaging script for an educational science video. 
  
      Guidelines:
      - Do NOT invent facts.
      - Combine, summarize, and expand the text if needed.
      - The style should be friendly, scientific, and accessible for high school or university students.
      - Aim the content for duration: ${duration} (IMPORTANT!).
      - Writing styles: ${writingStyles}
      - Start with a hook like "Let’s explore the topic..." or anything similar.
      - Response only in Vietnamese.
      - Each segment must be between **30 seconds and 60 seconds**, must not be longer than 60 seconds.
      - Write the script by time section, e.g., "00:00 - 00:30", "00:30 - 01:00", etc (IMPORTANT!).
      - Must include ALL time sections from 00:00 to ${convertTime(duration)} with NO gaps or missing segments (IMPORTANT!).
      - Use the following format: "** [Name of this section: 00:00 - 00:30] **: \n[script content relating to this timeline]\n\nIdea 1: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\nIdea 2: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\n..." (IMPORTANT!).
      - Do not add () in script content of each section.
      - Each section must has only 1 to 3 ideas.
      - After each sections, suggest visual and audio elements, such as background music, text animations, call-to-action buttons. Write these elements in parentheses, like: (Upbeat background music), (Display email and logo), (Text animation for Subscribe button).
      - Double check total time coverage to ensure script reaches full ${duration} and all sections are accounted for (IMPORTANT!).
  
      Topic: ${topic}
      Content to use: content from Wikipedia, PubMed, and Nature in order, seperate by 2 empty lines.
      """ 
      ${rawText}
      """
      `;

  console.log("Prompt for script generation:", chatbot);

  if (chatbot === "Gemini") {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      const data = await res.json();
      //console.log("Gemini API response:", JSON.stringify(data, null, 2));

      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(
          "Script generated:",
          data.candidates[0].content.parts[0].text
        );
        return data.candidates[0].content.parts[0].text;
      } else {
        console.error("Unexpected response:", JSON.stringify(data, null, 2));
        return "Gemini did not return valid content.";
      }
    } catch (err) {
      console.error("Error calling Gemini API:", err);
      return "Gemini API error.";
    }
  } else if (chatbot === "OpenAI"){
    return callOpenAI(duration, topic, writingStyles,rawText);
  } else if (chatbot === "Groq") {
    return callGroq(duration, topic, writingStyles,rawText);
  } else if (chatbot === "DeepSeek") {
    return callDeepSeek(duration, topic, writingStyles,rawText);
  } else {
    return "Chatbot is not available. Please try again later.";
  }
}

async function crawlWikipedia(topic) {
  const encodedTopic = encodeURIComponent(topic);

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodedTopic}&limit=1&namespace=0&format=json`;
    const searchResponse = await axios.get(searchUrl);
    const resultTitles = searchResponse.data?.[1];
    if (!resultTitles || resultTitles.length === 0) {
      return "";
    }

    const bestMatch = resultTitles[0]; // lấy tiêu đề trang khớp nhất
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      bestMatch
    )}`;

    const summaryResponse = await axios.get(summaryUrl);
    return summaryResponse.data.extract || "No content found.";
  } catch (error) {
    return "";
  }
}

async function crawlPubMed(topic) {
  const encodedTopic = encodeURIComponent(topic);
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmax=1&retmode=json&term=${encodedTopic}&api_key=${process.env.pubmed_API_KEY}`;
  console.log("Search pubmed URL:", searchUrl);

  try {
    const searchResponse = await axios.get(searchUrl);
    console.log("Search Response:", searchResponse.data);
    const idList = searchResponse.data?.esearchresult?.idlist;

    if (!idList || idList.length === 0) {
      return "";
    }

    const id = String(idList[0]);
    console.log("PubMed ID:", id);

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${id}&retmode=xml`;
    const fetchResponse = await axios.get(fetchUrl);
    const xml = fetchResponse.data;
    console.log("XML Response:", fetchResponse.data);

    var parseString = require("xml2js").parseString;
    let result;
    parseString(xml, function (err, parsedResult) {
      if (err) {
        console.error("Error parsing XML:", err);
        return;
      }
      result = parsedResult;
    });

    const article = result?.PubmedArticleSet?.PubmedArticle?.[0];
    const abstractText =
      article?.MedlineCitation[0]?.Article?.[0]?.Abstract?.[0].AbstractText;
    console.log("Abstract Text:", abstractText);

    // Nếu abstract có nhiều đoạn thì nối lại
    const text = Array.isArray(abstractText)
      ? abstractText
          .map((t) => (typeof t === "string" ? t : t._ || ""))
          .join(" ")
      : abstractText;

    //console.log("Parsed Text:", text);
    return text.replace(/\s+/g, " ").trim();
  } catch (error) {
    return "";
  }
}

async function crawlNature(topic) {
  const encodedTopic = encodeURIComponent(topic);
  const searchUrl = `https://www.nature.com/search?q=${encodedTopic}&order=relevance`;

  try {
    console.log("Search Nature URL:", searchUrl);
    const searchPage = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(searchPage.data);
    const firstArticleLink = $("li.app-article-list-row__item a")
      .first()
      .attr("href");

    if (!firstArticleLink) {
      return "";
    }

    const fullArticleUrl = `https://www.nature.com${firstArticleLink}`;
    console.log("Article URL:", fullArticleUrl);

    // Lấy nội dung bài đầu tiên
    const articlePage = await axios.get(fullArticleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $$ = cheerio.load(articlePage.data);
    const title = $$("h1.c-article-title").text().trim();
    const abstract = $$("div.c-article-section__content p")
      .first()
      .text()
      .trim();

    return `${title}\n\n Abstract: ${abstract}`;
  } catch (error) {
    console.error("Lỗi crawl Nature:", error.message);
    throw new Error("Failed to crawl Nature.");
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

async function callOpenAI(duration, topic, writingStyles, rawText) {
  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `You are a scientific scriptwriter for educational videos.
  
      Using ONLY the following content from trusted sources (Wikipedia, PubMed, Nature), create a clear and engaging script for an educational science video. 
  
      Guidelines:
      - Do NOT invent facts.
      - Combine, summarize, and expand the text if needed.
      - The style should be friendly, scientific, and accessible for high school or university students.
      - Aim the content for duration: ${duration} (IMPORTANT!).
      - Writing styles: ${writingStyles}
      - Start with a hook like "Let’s explore the topic..." or anything similar.
      - Response only in Vietnamese.
      - Each segment must be between **30 seconds and 60 seconds**, must not be longer than 60 seconds.
      - Write the script by time section, e.g., "00:00 - 00:30", "00:30 - 01:00", etc (IMPORTANT!).
      - Must include ALL time sections from 00:00 to ${convertTime(duration)} with NO gaps or missing segments (IMPORTANT!).
      - Use the following format: "** [Name of this section: 00:00 - 00:30] **: \n[script content relating to this timeline]\n\nIdea 1: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\nIdea 2: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\n..." (IMPORTANT!).
      - Do not add () in script content of each section.
      - Each section must has only 1 to 3 ideas
      - After each sections, suggest visual and audio elements, such as background music, text animations, call-to-action buttons. Write these elements in parentheses, like: (Upbeat background music), (Display email and logo), (Text animation for Subscribe button).
      - Double check total time coverage to ensure script reaches full 3 minutes and all sections are accounted for (IMPORTANT!).
  
      Topic: ${topic}
      Content to use: content from Wikipedia, PubMed, and Nature in order, seperate by 2 empty lines.
      """ 
      ${rawText}
      """
        `,
        },
      ],
    });

    console.log("OpenAI: ", completion.choices[0].message.content);
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error.response?.data || error.message);
    return "OpenAI API error.";
  }
}

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function callGroq(duration, topic, writingStyles, rawText) {
  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `You are a scientific scriptwriter for educational videos.
  
      Using ONLY the following content from trusted sources (Wikipedia, PubMed, Nature), create a clear and engaging script for an educational science video. 
  
      Guidelines:
      - Do NOT invent facts.
      - Combine, summarize, and expand the text if needed.
      - The style should be friendly, scientific, and accessible for high school or university students.
      - Aim the content for duration: ${duration} (IMPORTANT!).
      - Writing styles: ${writingStyles}
      - Start with a hook like "Let’s explore the topic..." or anything similar.
      - Response only in Vietnamese.
      - Each segment must be between **30 seconds and 60 seconds**, must not be longer than 60 seconds.
      - Write the script by time section, e.g., "00:00 - 00:30", "00:30 - 01:00", etc (IMPORTANT!).
      - Must include ALL time sections from 00:00 to ${convertTime(duration)} with NO gaps or missing segments (IMPORTANT!).
      - Use the following format: "** [Name of this section: 00:00 - 00:30] ** : \n[script content relating to this timeline]\n\nIdea 1: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\nIdea 2: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\n..." (IMPORTANT!).
      - Put "Name of this section: " before time section and add [] between them.
      - (IMPORTANT!) Then add ":" right after them like "** [Name of this section: time section - time section] **:". 
      - Do not add () in script content of each section.
      - Each section must has only 1 to 3 ideas.
      - After each sections, suggest visual and audio elements, such as background music, text animations, call-to-action buttons. Write these elements in parentheses, like: (Upbeat background music), (Display email and logo), (Text animation for Subscribe button).
      - Double check total time coverage to ensure script reaches full ${duration} and all sections are accounted for (IMPORTANT!).
  
      Topic: ${topic}
      Content to use: content from Wikipedia, PubMed, and Nature in order, seperate by 2 empty lines.
      """ 
      ${rawText}
      """
          `,
        },
      ],
      model: "llama3-70b-8192",
    });

    console.log("Groq: ", chatCompletion.choices[0].message.content);
    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error("Error calling Groq API:", error.response?.data || error.message);
    return "Groq API error.";
  }
}

async function callDeepSeek(duration, topic, writingStyles, rawText) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-r1:free",
        messages: [
          {
            role: "user",
            content: `You are a scientific scriptwriter for educational videos.
  
      Using ONLY the following content from trusted sources (Wikipedia, PubMed, Nature), create a clear and engaging script for an educational science video. 
  
      Guidelines:
      - Do NOT invent facts.
      - Combine, summarize, and expand the text if needed.
      - The style should be friendly, scientific, and accessible for high school or university students.
      - Aim the content for duration: ${duration} (IMPORTANT!).
      - Writing styles: ${writingStyles}
      - Start with a hook like "Let’s explore the topic..." or anything similar.
      - Response only in Vietnamese.
      - Each segment must be between **30 seconds and 60 seconds**, must not be longer than 60 seconds.
      - Write the script by time section, e.g., "00:00 - 00:30", "00:30 - 01:00", etc (IMPORTANT!).
      - Must include ALL time sections from 00:00 to ${convertTime(duration)} with NO gaps or missing segments (IMPORTANT!).
      - Use the following format: "** [Name of this section: 00:00 - 00:30] **: \n[script content relating to this timeline]\n\nIdea 1: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\nIdea 2: \nText:[content of this idea]\nVisual:[Suggest image prompt to generate by AI]\n..." (IMPORTANT!).
      - Do not add () in script content of each section.
      - Each section must has only 1 to 3 ideas
      - After each sections, suggest visual and audio elements, such as background music, text animations, call-to-action buttons. Write these elements in parentheses, like: (Upbeat background music), (Display email and logo), (Text animation for Subscribe button).
      - Double check total time coverage to ensure script reaches full ${duration} and all sections are accounted for (IMPORTANT!).
  
      Topic: ${topic}
      Content to use: content from Wikipedia, PubMed, and Nature in order, seperate by 2 empty lines.
      """ 
      ${rawText}
      """
          `,
          },
        ],
      },
      {
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
        }
      }
    );

    console.log("Message", response.data.choices[0].message);
    console.log("Deepseek: ", response.data.choices[0].message.content);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling DeepSeek API:", error.response?.data || error.message);
    return "DeepSeek API error.";
  }
}

module.exports = { generateScript, crawlWikipedia, crawlPubMed, crawlNature };
