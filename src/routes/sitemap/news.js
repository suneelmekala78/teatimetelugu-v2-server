import express from "express";
import News from "../../models/newsModel.js";

const router = express.Router();

router.get("/sitemap-news.xml", async (req, res) => {
  try {
    const isEnglish = req.headers.host.includes("english");
    const baseURL = isEnglish
      ? "https://english.teatimetelugu.com"
      : "https://teatimetelugu.com";

    const news = await News.find({}).sort({ updatedAt: -1 }).limit(5000);

    const urls = news.map((n) => {
      const lang = isEnglish ? "en" : "te";
      const category = n.category?.[lang] || "news";
      const id = n.newsId;
      const lastmod = new Date(n.updatedAt).toISOString();
      return `
        <url>
          <loc>${baseURL}/${category}/${id}</loc>
          <lastmod>${lastmod}</lastmod>
          <changefreq>hourly</changefreq>
          <priority>1.0</priority>
        </url>
      `;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${urls.join("")}
      </urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error) {
    console.error("Sitemap News Error:", error);
    res.status(500).send("Error generating sitemap-news.xml");
  }
});

export default router;
