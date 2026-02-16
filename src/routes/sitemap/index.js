import express from "express";

const router = express.Router();

router.get("/sitemap.xml", (req, res) => {
  const isEnglish = req.headers.host.includes("english");
  const baseURL = isEnglish
    ? "https://english.teatimetelugu.com"
    : "https://teatimetelugu.com";

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap>
        <loc>${baseURL}/sitemap-news.xml</loc>
      </sitemap>
      <sitemap>
        <loc>${baseURL}/sitemap-gallery.xml</loc>
      </sitemap>
      <sitemap>
        <loc>${baseURL}/sitemap-videos.xml</loc>
      </sitemap>
    </sitemapindex>`;

  res.header("Content-Type", "application/xml");
  res.send(sitemapIndex);
});

export default router;
