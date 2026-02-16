import "dotenv/config";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import passport from "passport";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
// import path from "path";
// import { fileURLToPath } from "url";

import dbConnection from "./src/config/db.js";
import { corsOptions } from "./src/config/cors.js";
import "./src/config/passport.js";

import router from "./src/routes/index.js";
import { errorHandler, notFound } from "./src/middlewares/errorHandler.js";
import ogPreviewRouter from "./src/routes/ogPreview.js";

import sitemapIndex from "./src/routes/sitemap/index.js";
import sitemapNews from "./src/routes/sitemap/news.js";
import sitemapGallery from "./src/routes/sitemap/gallery.js";
import sitemapVideos from "./src/routes/sitemap/videos.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
dbConnection();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);

// Performance middleware
app.use(compression());

app.use(cors(corsOptions));

// Trust proxy (important if behind reverse proxy)
app.set("trust proxy", 1);

app.use(cookieParser());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(passport.initialize());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
});

const speedLimiter = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 30,
  delayMs: () => 500,
});

app.use("/v1/", apiLimiter);
app.use("/v1/", speedLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Serve ads.txt directly
// app.get("/ads.txt", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "ads.txt"));
// });

app.use("/", sitemapIndex);
app.use("/", sitemapNews);
app.use("/", sitemapGallery);
app.use("/", sitemapVideos);
app.use("/", ogPreviewRouter);
app.use("/v1/", router);

// Bypass SSL verification for development (due to Kaspersky)
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Error handling middleware (should be last)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(
    `✅ Server running on port ${PORT} in ${
      process.env.NODE_ENV || "development"
    } mode`,
  );
});

export default app;
