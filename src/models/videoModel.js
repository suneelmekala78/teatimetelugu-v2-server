import mongoose, { Schema } from "mongoose";

const videoSchema = new mongoose.Schema(
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

    mainUrl: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },

    // Category in both languages
    category: {
      en: { type: String, index: true, default: "videos" },
      te: { type: String, default: "వీడియోలు" },
    },

    // Optional sub-category
    subCategory: {
      en: { type: String, index: true },
      te: { type: String },
    },
  },
  { timestamps: true }
);

// 🔹 Text index for search on titles + descriptions
videoSchema.index(
  {
    "title.en": "text",
    "title.te": "text",
  },
  {
    weights: {
      "title.en": 5,
      "title.te": 5,
    },
    name: "VideoTextIndex",
  }
);
videoSchema.index({ "category.en": 1, createdAt: -1 });
videoSchema.index({ "title.en": 1 });
videoSchema.index({ "title.te": 1 });
videoSchema.index({ createdAt: -1 });

const Video = mongoose.model("Video", videoSchema);

export default Video;
