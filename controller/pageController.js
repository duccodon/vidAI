const controller =  {};
const models = require('../models'); 

const bcrypt = require('bcrypt'); // Ensure password security
const { Op, where } = require('sequelize');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { fn, col, literal } = require("sequelize");

const axios = require('axios'); //crawl Wikipedia
const xml2js = require("xml2js"); // crawl PubMed
const cheerio = require('cheerio'); // crawl Nature



controller.showLogin = (req, res) => {
    const errorMessage = req.flash('errorMessage');
    
    req.session.destroy(err => {
      if (err) {
        console.error('Failed to destroy session:', err);
      }
    });
  
    return res.render('login', {
      layout: 'account',
      title: 'Login',
      errorMessage,   
    });
};

controller.login = async (req, res) => {
  const { usernameOrEmail, password } = req.body; // Get login credentials from the request body

  try {
    // Check if the input is an email or username
    let user;
    if (usernameOrEmail.includes('@')) {
      // If it's an email (contains '@'), search by email
    user = await models.User.findOne({
        where: {
          email: usernameOrEmail,
        },
      });
    } 
    else {
      // If it's a username, search by username
      user = await models.User.findOne({
        where: {
          username: usernameOrEmail,
        },
      });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render("login", {
        layout: "account",
        title: "Login",
        errorMessage: "Invalid username, email or password.",
      });
    }

    if (!user.isVerified) {
      return res.render("login", {
        layout: "account",
        title: "Login",
        errorMessage: "This account has not been verified. Please check your email.",
      });
    }

    // Password is correct, redirect to Homepage
    req.session.userId = user.id;
    return res.redirect("/Homepage");
  } catch (error) {
    console.error(error);
    res.status(500).render("login", {
      layout: "account",
      title: "Login",
      errorMessage: "An error occurred. Please try again later."
    });
  }
};

controller.showHomepage = async (req, res) => {
  const userId = req.session.userId; 

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  res.render("homepage", { headerName: "Home", page: 1 });
};

controller.showEditVideo = async (req, res) => {
  const userId = req.session.userId; 

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  res.render("editVideo", { headerName: "Edit video", page: 2 });
};

controller.showProfile = async (req, res) => {
  const userId = req.session.userId; 

  res.locals.currentUser = await models.User.findByPk(userId, (err, user) => {
    if (err) {
      return res.status(500).send("Error retrieving user information");
    }
  });
  res.locals.loggingInUser = res.locals.currentUser;

  res.render("profile", { headerName: "Profile", page: 3 });
};

controller.genScript = async (req, res) => {
  const { topic } = req.body;
  console.log("Topic received:", topic); 

  if (!topic) return res.status(400).json({ success: false, message: "No topic provided" });
    const rawText = await crawlWikipedia(topic);
    const pubmedText = await crawlPubMed(topic); 
    const natureText = await crawlNature(topic);

    console.log("Raw text from Wikipedia:", rawText); 
    console.log("\nRaw text from PubMed:", pubmedText);
    console.log("\nRaw text from Nature:", natureText);
    //const script = await generateScript(rawText); 
 try {
    return res.json({ success: true, script });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Error generating script" });
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
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestMatch)}`;

    const summaryResponse = await axios.get(summaryUrl);
    return summaryResponse.data.extract || "No content found.";
  } catch (error) {
    return "";
  }
}

async function crawlPubMed(topic) {
  const encodedTopic = encodeURIComponent(topic);
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmax=1&retmode=json&term=${encodedTopic}`;
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


    var parseString = require('xml2js').parseString;
    let result;
    parseString(xml, function (err, parsedResult) {
      if (err) {
        console.error("Error parsing XML:", err);
        return;
      }
      result = parsedResult;
    });

    const article = result?.PubmedArticleSet?.PubmedArticle?.[0];
    const abstractText = article?.MedlineCitation[0]?.Article?.[0]?.Abstract?.[0].AbstractText;
    console.log("Abstract Text:", abstractText);  

    // Nếu abstract có nhiều đoạn thì nối lại
    const text = Array.isArray(abstractText)
       ? abstractText.map((t) => (typeof t === "string" ? t : t._ || "")).join(" ")
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
        "User-Agent": "Mozilla/5.0"
      }
    });

    const $ = cheerio.load(searchPage.data);
    const firstArticleLink = $("li.app-article-list-row__item a").first().attr("href");

    if (!firstArticleLink) {
      return "";
    }

    const fullArticleUrl = `https://www.nature.com${firstArticleLink}`;
    console.log("Article URL:", fullArticleUrl);

    // Lấy nội dung bài đầu tiên
    const articlePage = await axios.get(fullArticleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const $$ = cheerio.load(articlePage.data);
    const title = $$("h1.c-article-title").text().trim();
    const abstract = $$("div.c-article-section__content p").first().text().trim();

    return `${title}\n\n Abstract: ${abstract}`;
  } catch (error) {
    console.error("Lỗi crawl Nature:", error.message);
    throw new Error("Failed to crawl Nature.");
  }
}

module.exports = controller