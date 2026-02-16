import express from "express";
import Video from "../../models/videoModel.js";

const router = express.Router();

router.get("/sitemap-videos.xml", async (req, res) => {
  try {
    const isEnglish = req.headers.host.includes("english");
    const baseURL = isEnglish
      ? "https://english.teatimetelugu.com"
      : "https://teatimetelugu.com";

    const videos = await Video.find({}).sort({ updatedAt: -1 }).limit(5000);

    const urls = videos.map((v) => {
      const id = v.newsId;
      const lastmod = new Date(v.updatedAt).toISOString();
      return `
        <url>
          <loc>${baseURL}/videos/v/${id}</loc>
          <lastmod>${lastmod}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.7</priority>
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
    console.error("Sitemap Videos Error:", error);
    res.status(500).send("Error generating sitemap-videos.xml");
  }
});

export default router;
