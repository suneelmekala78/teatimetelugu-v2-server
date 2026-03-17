import mongoose, { Schema } from "mongoose";

const newsSchema = new mongoose.Schema(
  {
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // fast queries by user
    },

    newsId: {
      type: String,
      unique: true,
      required: true,
      index: true, // fast lookups
    },

    // Titles in both languages
    title: {
      en: { type: String, required: [true, "English title is required!"] },
      te: { type: String, required: [true, "Telugu title is required!"] },
    },

    // Main image / video URL
    mainUrl: {
      type: String,
      required: true,
    },

    // Descriptions in both languages
    description: {
      en: {
        text: { type: String, required: [true, "English description is required!"] },
        withTags: { type: String }, // HTML or text with hashtags for UI
      },
      te: {
        text: { type: String, required: [true, "Telugu description is required!"] },
        withTags: { type: String },
      },
    },

    // Category in both languages
    category: {
      en: { type: String, required: true, index: true },
      te: { type: String, required: true },
    },

    // Optional sub-category
    subCategory: {
      en: { type: String, index: true },
      te: { type: String },
    },

    movieRating: {
      type: Number,
      default: 0,
    },

    newsAudio: {
      en: { type: String },
      te: { type: String },
    },

    // Reactions (like 👍, ❤️, etc.)
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        type: { type: String, required: true },
      },
    ],
    commentsCount: { type: Number, default: 0 },
    reactionsCount: { type: Number, default: 0 },

    // Tags (English & Telugu)
    tags: {
      en: { type: [String], index: true },
      te: { type: [String] },
    },
  },
  { timestamps: true }
);

newsSchema.index({ "category.en": 1, createdAt: -1 });
newsSchema.index({ "subCategory.en": 1, createdAt: -1 });
newsSchema.index({ "category.en": 1, "subCategory.en": 1, createdAt: -1 });
newsSchema.index({ createdAt: -1 }); // already sort by recent
newsSchema.index({ 
  "category.en": 1, 
  createdAt: -1, 
  "title.en": "text", 
  "title.te": "text" 
});

// 🔹 Text index for search on titles + descriptions
newsSchema.index(
  {
    "title.en": "text",
    "title.te": "text",
    "description.en.text": "text",
    "description.te.text": "text",
  },
  {
    weights: {
      "title.en": 5,
      "title.te": 5,
      "description.en.text": 1,
      "description.te.text": 1,
    },
    name: "NewsTextIndex",
  }
);

const News = mongoose.model("News", newsSchema);

export default News;
