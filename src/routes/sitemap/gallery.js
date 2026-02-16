import express from "express";
import Gallery from "../../models/galleryModel.js";

const router = express.Router();

router.get("/sitemap-gallery.xml", async (req, res) => {
  try {
    const isEnglish = req.headers.host.includes("english");
    const baseURL = isEnglish
      ? "https://english.teatimetelugu.com"
      : "https://teatimetelugu.com";

    const gallery = await Gallery.find({}).sort({ updatedAt: -1 }).limit(5000);

    const urls = gallery.map((g) => {
      const lang = isEnglish ? "en" : "te";
      const id = g.newsId;
      const lastmod = new Date(g.updatedAt).toISOString();
      return `
        <url>
          <loc>${baseURL}/gallery/${id}</loc>
          <lastmod>${lastmod}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.8</priority>
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
    console.error("Sitemap Gallery Error:", error);
    res.status(500).send("Error generating sitemap-gallery.xml");
  }
});

export default router;
