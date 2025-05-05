const axios = require("axios"); //crawl Wikipedia
const xml2js = require("xml2js"); // crawl PubMed
const cheerio = require("cheerio"); // crawl Nature

const dotenv = require("dotenv");
dotenv.config();

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
      - Aim the content for duration: ${duration}.
      - Writing styles: ${writingStyles}
      - Start with a hook like "Let’s explore the topic..." or anything similar.
      - Response only in Vietnamese.
      - Write the script by time section, e.g., "00:00 - 00:30", "00:30 - 01:00", etc.
      - Use the following format: "** [Name of this section: 00:00 - 00:30] **: \n[script content relating to this timeline]".
      - After each sections, suggest visual and audio elements, such as background music, text animations, call-to-action buttons. Write these elements in parentheses, like: (Upbeat background music), (Display email and logo), (Text animation for Subscribe button).
  
      Topic: ${topic}
      Content to use: content from Wikipedia, PubMed, and Nature in order, seperate by 2 empty lines.
      """ 
      ${rawText}
      """
      `;

  console.log("Prompt for script generation:", chatbot + "\n" + prompt);

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
  } else {
    return "Chatbot is not available. Please try again later.";
  }
}

async function callHuggingFace(prompt) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
      }),
    }
  );

  const data = await response.json();
  return data[0]?.generated_text || "No response";
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

module.exports = { generateScript, crawlWikipedia, crawlPubMed, crawlNature };
