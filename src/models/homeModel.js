import mongoose, { Schema } from "mongoose";

const homeSchema = new mongoose.Schema(
  {
    // 🔹 Breaking news section
    breakingNews: [
      {
        news: { type: Schema.Types.ObjectId, ref: "News" },
        position: { type: Number, min: 1 },
      },
    ],

    // 🔹 Trending news
    trends: [
      {
        news: { type: Schema.Types.ObjectId, ref: "News" },
        position: { type: Number, min: 1, max: 5 },
      },
    ],

    // 🔹 Top five grid
    topFiveGrid: [
      {
        news: { type: Schema.Types.ObjectId, ref: "News" },
        position: { type: Number, min: 1, max: 5 },
      },
    ],

    // 🔹 Hot topics
    hotTopics: [
      {
        news: { type: Schema.Types.ObjectId, ref: "News" },
        position: { type: Number, min: 1 },
      },
    ],

    // 🔹 Top nine news cards
    topNine: [
      {
        news: { type: Schema.Types.ObjectId, ref: "News" },
        position: { type: Number, min: 1, max: 9 },
      },
    ],

    // 🔹 Category top posts
    categoryTopPosts: [
      {
        category: { type: String, required: true, trim: true },
        posts: [
          {
            news: { type: Schema.Types.ObjectId, ref: "News" },
            position: { type: Number, min: 1, max: 5 },
          },
        ],
      },
    ],

    // 🔹 Extra files or links
    filesLinks: [{ type: String }], 

    // 🔹 Upcoming movie releases
    movieReleases: [
      {
        movie: {
          en: { type: String, required: true },
          te: { type: String, required: true },
        },
        date: {
          en: { type: String, required: true },
          te: { type: String, required: true },
        },
        category: {
          en: { type: String, required: true },
          te: { type: String, required: true },
        },
      },
    ],

    // 🔹 Movie collections
    movieCollections: [
      {
        movie: {
          en: { type: String, required: true },
          te: { type: String, required: true },
        },
        amount: {
          en: { type: String, required: true }, // e.g., "100 Crores"
          te: { type: String, required: true }, // e.g., "100 కోట్లు"
        },
        category: {
          en: { type: String, required: true },
          te: { type: String, required: true },
        },
      },
    ],

    // 🔹 Posters (popup, movie, navbar)
    posters: {
      popupPoster: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
      },
      moviePoster: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
      },
      navbarAd: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
      },
    },

    // 🔹 Ads for various placements
    ads: {
      homeLongAd: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
      homeShortAd: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
      categoryLongAd: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
      categoryShortAd: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
      newsLongAd: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
      newsShortAd: {
        img: { type: String, default: "" },
        link: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    },
  },
  { timestamps: true }
);

// 🔹 Ensure category lookups are faster
homeSchema.index({ "categoryTopPosts.category": 1 });

const Home = mongoose.model("Home", homeSchema);

export default Home;
