const axios = require("axios");

async function crawlWikipedia(topic) {
  const encodedTopic = encodeURIComponent(topic);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTopic}`;
  try {
    const response = await axios.get(url);
    return response.data.extract || "";
  } catch (err) {
    console.error("Wikipedia error:", err.message);
    return "";
  }
}

async function crawlPubMed(topic) {
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmax=1&retmode=json&term=${encodeURIComponent(topic)}`;
  try {
    const searchResponse = await axios.get(searchUrl);
    const idList = searchResponse.data?.esearchresult?.idlist;
    if (!idList || idList.length === 0) return "";

    const id = idList[0];
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${id}&retmode=json`;
    const fetchResponse = await axios.get(fetchUrl);
    const summary = fetchResponse.data?.result?.[id]?.title;
    return summary || "";
  } catch (err) {
    console.error("PubMed error:", err.message);
    return "";
  }
}

async function crawlMultipleSources(topic) {
  const [wiki, pubmed] = await Promise.all([
    crawlWikipedia(topic),
    crawlPubMed(topic)
    // Future: crawlNature(topic) nếu có cách crawl an toàn
  ]);

  return [wiki, pubmed]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

module.exports = {
  crawlWikipedia,
  crawlPubMed,
  crawlMultipleSources,
};
