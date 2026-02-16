import express from "express";
import News from "../models/newsModel.js";

const router = express.Router();

// Example URL handled: https://teatimetelugu.com/news/12345
// OR https://english.teatimetelugu.com/news/12345
router.get("/news/:newsId", async (req, res) => {
  try {
    const { newsId } = req.params;

    // Detect language based on hostname
    const host = req.get("host");
    const isEnglish = host?.includes("english.");

    // Find the article
    const news = await News.findOne({ newsId }).select("title description mainUrl category");

    if (!news) {
      return res.status(404).send("<h1>News not found</h1>");
    }

    // Pick fields based on language
    const lang = isEnglish ? "en" : "te";
    const title = news.title?.[lang] || "Tea Time Telugu";
    const desc =
      news.description?.[lang]?.text?.slice(0, 150)?.replace(/["']/g, "") ||
      (isEnglish
        ? "Read the latest Telugu news in English — Tea Time Telugu"
        : "తెలుగులో తాజా వార్తలు చదవండి — టీ టైం తెలుగు");
    const imageUrl = news.mainUrl || "https://teatimetelugu.com/default-image.jpg";

    // Construct proper redirect URL for frontend
    const baseUrl = isEnglish
      ? "https://english.teatimetelugu.com"
      : "https://teatimetelugu.com";
    const pageUrl = `${baseUrl}/news/${newsId}`;

    // Return HTML with OG tags for social preview
    const html = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>

        <!-- ✅ Open Graph -->
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${desc}" />
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:url" content="${pageUrl}" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Tea Time Telugu" />

        <!-- ✅ Twitter Card -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${desc}" />
        <meta name="twitter:image" content="${imageUrl}" />

        <meta http-equiv="refresh" content="0; url='${pageUrl}'" />
      </head>
      <body>
        <p>Redirecting to <a href="${pageUrl}">${pageUrl}</a>...</p>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error("OG Preview Error:", error);
    res.status(500).send("Internal server error");
  }
});

export default router;
