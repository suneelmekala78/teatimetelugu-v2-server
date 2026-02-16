import mongoose, { Schema } from "mongoose";

const gallerySchema = new mongoose.Schema(
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
      index: true, // fast lookup
    },

    name: {
      en: { type: String, required: [true, "English name is required!"] },
      te: { type: String, required: [true, "Telugu name is required!"] },
    },

    title: {
      en: { type: String, required: [true, "English title is required!"] },
      te: { type: String, required: [true, "Telugu title is required!"] },
    },

    mainUrl: {
      type: String, // main image/video URL
    },

    description: {
      en: {
        text: {
          type: String,
          required: [true, "English description is required!"],
        },
        withTags: { type: String }, // text with hashtags for UI
      },
      te: {
        text: {
          type: String,
          required: [true, "Telugu description is required!"],
        },
        withTags: { type: String }, // text with hashtags for UI
      },
    },

    category: {
      en: { type: String, required: true, index: true },
      te: { type: String, required: true },
    },

    galleryPics: {
      type: [String], // array of image URLs
    },

    tags: {
      en: { type: [String], index: true },
      te: { type: [String] },
    },

    galleryAudio: {
      en: { type: String }, // optional English audio
      te: { type: String }, // optional Telugu audio
    },

    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        type: { type: String, required: true },
      },
    ],

    commentsCount: { type: Number, default: 0 },
    reactionsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Text index for fast search on name + title + descriptions
gallerySchema.index(
  {
    "name.en": "text",
    "name.te": "text",
    "title.en": "text",
    "title.te": "text",
    "description.en.text": "text",
    "description.te.text": "text",
  },
  {
    weights: {
      "title.en": 5,
      "title.te": 5,
      "name.en": 3,
      "name.te": 3,
      "description.en.text": 1,
      "description.te.text": 1,
    },
    name: "GalleryTextIndex",
  }
);

const Gallery = mongoose.model("Gallery", gallerySchema);

export default Gallery;
