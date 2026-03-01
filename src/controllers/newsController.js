import sanitizeHtml from "sanitize-html";
import News from "../models/newsModel.js";
import Gallery from "../models/galleryModel.js";
import Video from "../models/videoModel.js";
import Users from "../models/userModel.js";
import { uploadFile } from "../utils/s3Service.js";
import { generateUniqueSlug } from "../utils/generateUniqueSlug.js";
import mongoose from "mongoose";
import { generateAudioForTexts } from "../utils/audio.js";
// import { sendNewsAddedEmail } from "../utils/mail.js";

export const addNews = async (req, res) => {
  // Check if req.body exists
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      status: "fail",
      message: "Invalid request body",
    });
  }
  try {
    const {
      titleEn,
      titleTe,
      descriptionEn,
      descriptionTe,
      categoryEn,
      categoryTe,
      subCategoryEn,
      subCategoryTe,
      tagsEn,
      tagsTe,
      movieRating,
    } = req.body;

    const { user } = req.user;

    // ✅ Validate required fields
    if (!titleEn || !titleTe) {
      return res.status(400).json({
        status: "fail",
        message: "Titles in both languages are required!",
      });
    }

    if (!descriptionEn || !descriptionTe) {
      return res.status(400).json({
        status: "fail",
        message: "Descriptions in both languages are required!",
      });
    }

    if (!categoryEn || !categoryTe) {
      return res.status(400).json({
        status: "fail",
        message: "Categories in both languages are required!",
      });
    }

    if (!tagsEn?.length && !tagsTe?.length) {
      return res
        .status(400)
        .json({ status: "fail", message: "At least one tag is required!" });
    }

    if (!user) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found!" });
    }

    // ✅ sanitize & prepare dual descriptions
    // const enHtml = sanitizeHtml(descriptionEn, {
    //   allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    // });
    // const teHtml = sanitizeHtml(descriptionTe, {
    //   allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    // });

    // ✅ sanitize & prepare dual descriptions
    const enHtml = sanitizeHtml(descriptionEn, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "iframe",
        "blockquote",
        "a",
        "video",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "strike",
        "del",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
      ]),
      allowedAttributes: {
        img: ["src", "alt", "width", "height", "loading"],
        iframe: [
          "src",
          "width",
          "height",
          "allow",
          "allowfullscreen",
          "frameborder",
          "title",
        ],
        blockquote: ["class", "data-instgrm-permalink", "data-twitter-id"], // Instagram, Twitter
        a: ["href", "target", "rel"],
        video: ["src", "controls", "autoplay", "loop", "muted"],
      },
      allowedIframeHostnames: [
        "www.youtube.com",
        "player.vimeo.com",
        "www.instagram.com",
        "platform.twitter.com",
        "www.facebook.com",
        "www.tiktok.com",
      ],
    });
    const teHtml = sanitizeHtml(descriptionTe, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "iframe",
        "blockquote",
        "a",
        "video",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "strike",
        "del",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
      ]),
      allowedAttributes: {
        img: ["src", "alt", "width", "height", "loading"],
        iframe: [
          "src",
          "width",
          "height",
          "allow",
          "allowfullscreen",
          "frameborder",
          "title",
        ],
        blockquote: ["class", "data-instgrm-permalink", "data-twitter-id"],
        a: ["href", "target", "rel"],
        video: ["src", "controls", "autoplay", "loop", "muted"],
      },
      allowedIframeHostnames: [
        "www.youtube.com",
        "player.vimeo.com",
        "www.instagram.com",
        "platform.twitter.com",
        "www.facebook.com",
        "www.tiktok.com",
      ],
    });

    const enText = sanitizeHtml(descriptionEn, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
    const teText = sanitizeHtml(descriptionTe, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();

    const currentUser = await Users.findById(user?._id);

    if (
      (currentUser?.role !== "admin" && currentUser?.role !== "writer") ||
      currentUser?.isActive === false
    ) {
      return res.status(403).json({
        status: "fail",
        message: "You don't have permission to post!",
      });
    }

    // ✅ Upload main image / video
    let mainUrl = "";
    if (req.file) {
      const uploadResult = await uploadFile(req.file);
      mainUrl = uploadResult.Location;
    } else {
      return res
        .status(400)
        .json({ status: "fail", message: "Main image is required!" });
    }

    // ✅ Generate unique newsId
    const newsId = await generateUniqueSlug(News, titleEn);
    const audioFiles = await generateAudioForTexts({
      enTitle: titleEn,
      enDescription: enText,
      teTitle: titleTe,
      teDescription: teText,
    });

    // ✅ Create new post
    const newPost = new News({
      postedBy: user?._id,
      newsId,
      mainUrl,
      title: {
        en: titleEn,
        te: titleTe,
      },
      description: {
        en: { text: enText, withTags: enHtml },
        te: { text: teText, withTags: teHtml },
      },
      category: {
        en: categoryEn,
        te: categoryTe,
      },
      subCategory: {
        en: subCategoryEn || "",
        te: subCategoryTe || "",
      },
      newsAudio: {
        en: audioFiles.en,
        te: audioFiles.te,
      },
      tags: {
        en: tagsEn ? tagsEn.split(",").map((t) => t.trim()) : [],
        te: tagsTe ? tagsTe.split(",").map((t) => t.trim()) : [],
      },
      movieRating: movieRating || 0,
    });

    await newPost.save();

    // ✅ Notify admins & writers
    // const users = await Users.find({
    //   role: { $in: ["admin", "writer"] },
    //   _id: { $ne: user?._id },
    // });

    // users.forEach((u) => {
    //   sendNewsAddedEmail({
    //     email: u.email,
    //     fullName: u.fullName,
    //     postedBy: user?.fullName,
    //     category: categoryEn, // English category for email
    //     imgSrc: mainUrl,
    //     newsTitle: titleEn,
    //     postLink: `${process.env.CLIENT_URL}/${newPost?.category?.en}/${newPost?.newsId}`,
    //   });
    // });

    return res.status(201).json({
      status: "success",
      message: "News added successfully",
      news: newPost,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};

// ========= Paginated News =========
export const getFilteredNews = async (req, res) => {
  try {
    const {
      category = "",
      time = "",
      searchText = "",
      writer = "",
      page = 1,
      limit = 10,
    } = req.query;
    const skip =
      (Math.max(parseInt(page, 10) || 1, 1) - 1) *
      Math.min(parseInt(limit, 10) || 10, 100);

    const match = {};
    if (category) match["category.en"] = category.toLowerCase();
    if (writer && mongoose.Types.ObjectId.isValid(writer))
      match.postedBy = writer;
    if (searchText?.trim().length >= 3)
      match.$text = { $search: searchText.trim() };

    const dateFilter = getDateFilter(time);
    if (dateFilter) match.createdAt = dateFilter;

    // Only select needed fields
    const projection = {
      title: 1,
      newsId: 1,
      mainUrl: 1,
      category: 1,
      subCategory: 1,
      tags: 1,
      createdAt: 1,
      // "postedBy.fullName": 1,
      // "postedBy.profileUrl": 1,
    };

    const [news, totalItems] = await Promise.all([
      News.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(projection)
        .populate("postedBy", "fullName profileUrl")
        .lean(),
      News.countDocuments(match),
    ]);

    return res.status(200).json({
      status: "success",
      news,
      pagination: {
        currentPage: Math.floor(skip / limit) + 1,
        perPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ========= Cursor-based News =========
export const getFilteredNewsCursor = async (req, res) => {
  try {
    const {
      category = "",
      time = "",
      searchText = "",
      writer = "",
      limit = 10,
      cursor = null,
    } = req.query;
    const lim = Math.min(parseInt(limit, 10) || 10, 100);
    const match = {};

    if (category) match["category.en"] = category.toLowerCase();
    if (writer && mongoose.Types.ObjectId.isValid(writer))
      match.postedBy = writer;
    if (searchText?.trim().length >= 3)
      match.$text = { $search: searchText.trim() };

    const dateFilter = getDateFilter(time);
    if (dateFilter) match.createdAt = dateFilter;

    if (cursor) {
      const [lastCreatedAt, lastId] = cursor.split("_");
      match.$or = [
        { createdAt: { $lt: new Date(lastCreatedAt) } },
        { createdAt: new Date(lastCreatedAt), _id: { $lt: lastId } },
      ];
    }

    const projection = {
      title: 1,
      mainUrl: 1,
      category: 1,
      subCategory: 1,
      tags: 1,
      createdAt: 1,
      "postedBy.fullName": 1,
      "postedBy.profileUrl": 1,
    };

    const news = await News.find(match)
      .sort({ createdAt: -1, _id: -1 })
      .limit(lim + 1)
      .select(projection)
      .populate("postedBy", "fullName profileUrl")
      .lean();

    let nextCursor = null;
    let hasMore = false;

    if (news.length > lim) {
      hasMore = true;
      const lastItem = news[lim - 1];
      nextCursor = `${lastItem.createdAt.toISOString()}_${lastItem._id}`;
      news.pop();
    }

    return res.status(200).json({
      status: "success",
      data: { news, pagination: { nextCursor, hasMore, limit: lim } },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Helper: optimized suggested news
const getSuggestedNews = async (excludeId, limit = 20) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const filter = {
    _id: { $ne: excludeId },
    createdAt: { $gte: oneWeekAgo },
  };

  // Count documents for random skip
  const count = await News.countDocuments(filter);
  if (count === 0) return [];

  const maxSkip = Math.max(count - limit, 0);
  const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

  const suggestedNews = await News.find(filter)
    .sort({ createdAt: -1 })
    .skip(randomSkip)
    .limit(limit)
    .select("title newsId mainUrl category subCategory createdAt postedBy")
    .populate("postedBy", "fullName profileUrl")
    .lean();

  return suggestedNews;
};

// Optimized GET News by newsId
export const getNewsByNewsId = async (req, res) => {
  try {
    const { newsId } = req.params;
    if (!newsId) {
      return res
        .status(400)
        .json({ status: "fail", message: "newsId parameter is required" });
    }

    // Fetch main news first
    const [news, suggestedNews] = await Promise.all([
      News.findOne({ newsId })
        .select(
          "title mainUrl description category subCategory tags newsAudio movieRating reactions createdAt postedBy"
        )
        .populate("postedBy", "fullName profileUrl role")
        .lean(),
      getSuggestedNews(null), // pass null to skip exclude logic if not needed
    ]);

    if (!news) {
      return res
        .status(404)
        .json({ status: "fail", message: "News not found" });
    }

    // Fetch suggested news in parallel
    // const suggestedNews = await getSuggestedNews(news._id);

    return res.status(200).json({
      status: "success",
      news,
      suggestedNews,
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the news",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// GET News by MongoDB _id
export const getNewsById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "fail", message: "Invalid News ID!" });
    }

    const news = await News.findById(id)
      .select(
        "title mainUrl description category subCategory tags createdAt postedBy"
      )
      .populate("postedBy", "fullName profileUrl role")
      .lean();

    if (!news) {
      return res
        .status(404)
        .json({ status: "fail", message: "News not found!" });
    }

    return res.status(200).json({
      status: "success",
      news,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};

// ✅ Edit News by ID
export const editNews = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "News ID is required!",
      });
    }

    const {
      titleEn,
      titleTe,
      descriptionEn,
      descriptionTe,
      categoryEn,
      categoryTe,
      subCategoryEn,
      subCategoryTe,
      tagsEn,
      tagsTe,
      movieRating,
    } = req.body;

    const { user } = req.user;
    const news = await News.findById(id);

    if (!news) {
      return res
        .status(404)
        .json({ status: "fail", message: "News not found!" });
    }

    // ✅ Only author or admin can edit
    const currentUser = await Users.findById(user?._id);
    if (
      (currentUser.role !== "writer" && currentUser.role !== "admin") ||
      currentUser.isActive === false
    ) {
      return res.status(403).json({
        status: "fail",
        message: "You are not authorized to edit this news!",
      });
    }

    // ✅ Upload new image only if provided
    let mainUrl = news.mainUrl;
    if (req.file) {
      const uploadResult = await uploadFile(req.file);
      mainUrl = uploadResult.Location;
    }

    // ✅ sanitize & prepare dual descriptions
    // const enHtml = sanitizeHtml(descriptionEn, {
    //   allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    // });
    // const teHtml = sanitizeHtml(descriptionTe, {
    //   allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    // });

    // ✅ sanitize & prepare dual descriptions
    const enHtml = sanitizeHtml(descriptionEn, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "iframe",
        "blockquote",
        "a",
        "video",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "strike",
        "del",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
      ]),
      allowedAttributes: {
        img: ["src", "alt", "width", "height", "loading"],
        iframe: [
          "src",
          "width",
          "height",
          "allow",
          "allowfullscreen",
          "frameborder",
          "title",
        ],
        blockquote: ["class", "data-instgrm-permalink", "data-twitter-id"], // Instagram, Twitter
        a: ["href", "target", "rel"],
        video: ["src", "controls", "autoplay", "loop", "muted"],
      },
      allowedIframeHostnames: [
        "www.youtube.com",
        "player.vimeo.com",
        "www.instagram.com",
        "platform.twitter.com",
        "www.facebook.com",
        "www.tiktok.com",
      ],
    });
    const teHtml = sanitizeHtml(descriptionTe, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "iframe",
        "blockquote",
        "a",
        "video",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "strike",
        "del",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
      ]),
      allowedAttributes: {
        img: ["src", "alt", "width", "height", "loading"],
        iframe: [
          "src",
          "width",
          "height",
          "allow",
          "allowfullscreen",
          "frameborder",
          "title",
        ],
        blockquote: ["class", "data-instgrm-permalink", "data-twitter-id"],
        a: ["href", "target", "rel"],
        video: ["src", "controls", "autoplay", "loop", "muted"],
      },
      allowedIframeHostnames: [
        "www.youtube.com",
        "player.vimeo.com",
        "www.instagram.com",
        "platform.twitter.com",
        "www.facebook.com",
        "www.tiktok.com",
      ],
    });

    const enText = sanitizeHtml(descriptionEn, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();

    const teText = sanitizeHtml(descriptionTe, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();

    // ✅ Detect changes for audio
    const enChanged =
      (titleEn && titleEn !== news.title.en) ||
      (descriptionEn && descriptionEn !== news.description.en);

    const teChanged =
      (titleTe && titleTe !== news.title.te) ||
      (descriptionTe && descriptionTe !== news.description.te);

    let audioFiles = {};
    if (enChanged || teChanged) {
      // Clear only if regenerating
      if (enChanged) news.newsAudio.en = null;
      if (teChanged) news.newsAudio.te = null;

      audioFiles = await generateAudioForTexts({
        enTitle: enChanged ? titleEn : news.title.en,
        enDescription: enChanged ? enHtml : news.description.en,
        teTitle: teChanged ? titleTe : news.title.te,
        teDescription: teChanged ? teHtml : news.description.te,
      });
    }

    // ✅ Update only changed fields
    if (titleEn) news.title.en = titleEn;
    if (titleTe) news.title.te = titleTe;
    if (descriptionEn) news.description.en = { text: enText, withTags: enHtml };
    if (descriptionTe) news.description.te = { text: teText, withTags: teHtml };
    if (categoryEn) news.category.en = categoryEn;
    if (categoryTe) news.category.te = categoryTe;
    if (subCategoryEn) news.subCategory.en = subCategoryEn;
    if (subCategoryTe) news.subCategory.te = subCategoryTe;
    if (tagsEn) news.tags.en = tagsEn.split(",").map((t) => t.trim());
    if (tagsTe) news.tags.te = tagsTe.split(",").map((t) => t.trim());
    if (typeof movieRating !== "undefined") news.movieRating = movieRating;
    if (mainUrl) news.mainUrl = mainUrl;

    // ✅ Assign new audio if generated
    if (audioFiles.en) news.newsAudio.en = audioFiles.en;
    if (audioFiles.te) news.newsAudio.te = audioFiles.te;

    await news.save();

    return res.status(200).json({
      status: "success",
      message: "News updated successfully",
      news,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};

// ✅ Delete News
export const deleteNews = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.user;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "News ID is required!",
      });
    }

    const news = await News.findById(id);

    if (!news) {
      return res.status(404).json({
        status: "fail",
        message: "News not found!",
      });
    }

    // ✅ Only writer or admin can delete
    const currentUser = await Users.findById(user?._id);
    if (
      (currentUser.role !== "writer" && currentUser.role !== "admin") ||
      currentUser.isActive === false
    ) {
      return res.status(403).json({
        status: "fail",
        message: "You are not authorized to delete this news!",
      });
    }

    await news.deleteOne();

    return res.status(200).json({
      status: "success",
      message: "News deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};

//========= Frontend =========
export const getCategoryNews = async (req, res) => {
  try {
    const { category, subcategory, page = 1, limit = 12 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const match = {};
    if (category) match["category.en"] = category;
    if (subcategory) match["subCategory.en"] = subcategory;

    const result = await News.aggregate([
      { $match: match },

      // Sort newest first
      { $sort: { createdAt: -1 } },

      // Facet: get paginated results + total count
      {
        $facet: {
          news: [
            { $skip: skip },
            { $limit: limitNum },
            // Populate postedBy
            {
              $lookup: {
                from: "users",
                localField: "postedBy",
                foreignField: "_id",
                as: "postedBy",
              },
            },
            { $unwind: "$postedBy" }, // flatten array
            {
              $project: {
                title: 1,
                newsId: 1,
                category: 1,
                subCategory: 1,
                mainUrl: 1,
                createdAt: 1,
                movieRating: 1,
                "postedBy.fullName": 1,
                "postedBy.profileUrl": 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    const news = result[0].news || [];
    const total = result[0].total[0]?.count || 0;

    return res.status(200).json({
      status: "success",
      message: "Fetched news successfully",
      news,
      total,
      page: pageNum,
      lastPage: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("getCategoryNews aggregation error:", error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};

export const addReaction = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { type } = req.body;
    const userId = req.user.user?._id;

    if (!newsId) {
      return res
        .status(404)
        .send({ status: "fail", message: "News id not found!" });
    }

    if (!type) {
      return res
        .status(404)
        .send({ status: "fail", message: "Reaction type is not found!" });
    }

    if (!userId) {
      return res
        .status(404)
        .send({ status: "fail", message: "User id not found!" });
    }

    const news = await News.findById(newsId);
    if (!news) {
      return res
        .status(404)
        .send({ status: "fail", message: "News post not found" });
    }

    const existingReactionIndex = news.reactions.findIndex(
      (reaction) => reaction.userId.toString() === userId.toString()
    );

    if (existingReactionIndex >= 0) {
      news.reactions[existingReactionIndex].type = type;
    } else {
      news.reactions.push({ userId, type });
      await News.findByIdAndUpdate(newsId, { $inc: { reactionsCount: 1 } });
    }

    await news.save();

    res.status(200).send({
      status: "success",
      message: "Reaction added/updated successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      status: "fail",
      message: error.message,
    });
  }
};

//========= Home News =========

// Helper function for date filter
const getDateFilter = (time) => {
  const now = new Date();
  switch (time) {
    case "24h":
      return { $gte: new Date(now - 24 * 60 * 60 * 1000) };
    case "week":
      return { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
    case "month":
      return { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
    case "6months":
      return { $gte: new Date(now.setMonth(now.getMonth() - 6)) };
    case "1year":
      return { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
    case "2years":
      return { $gte: new Date(now.setFullYear(now.getFullYear() - 2)) };
    case "3years":
      return { $gte: new Date(now.setFullYear(now.getFullYear() - 3)) };
    default:
      if (time.startsWith("above")) {
        const key = time.replace("above", "");
        const aboveDate = new Date();
        if (key === "3years")
          aboveDate.setFullYear(aboveDate.getFullYear() - 3);
        else if (key === "2years")
          aboveDate.setFullYear(aboveDate.getFullYear() - 2);
        else if (key === "1year")
          aboveDate.setFullYear(aboveDate.getFullYear() - 1);
        else if (key === "6months")
          aboveDate.setMonth(aboveDate.getMonth() - 6);
        return { $lt: aboveDate };
      }
  }
  return null;
};

// ========= Latest News =========
export const getLatestNews = async (req, res) => {
  try {
    const projection = {
      title: 1,
      mainUrl: 1,
      newsId: 1,
      category: 1,
      createdAt: 1,
    };

    const news = await News.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .select(projection)
      .populate("postedBy", "fullName profileUrl")
      .lean();

    return res.status(200).json({ status: "success", news }); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ========= Trending News =========
export const getTrendingNews = async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const trendingNews = await News.find({ createdAt: { $gte: oneWeekAgo } })
      .sort({ reactionsCount: -1, commentsCount: -1, createdAt: -1 })
      .limit(10)
      .select(
        "title newsId mainUrl category createdAt postedBy reactionsCount commentsCount"
      )
      .populate("postedBy", "fullName profileUrl")
      .lean();

    return res.status(200).json({ status: "success", news: trendingNews });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};

// ========= Search News ===========
export const getSearchedNews = async (req, res) => {
  try {
    const {
      query,
      category = "",
      time = "",
      page = 1,
      limit = 10,
      type = "all",
    } = req.query;

    // console.log("Search query received:", query);
    // console.log("Search parameters:", { query, category, time, page, limit, type });

    // Validate required query parameter
    if (!query || query.trim() === "") {
      return res.status(400).json({
        status: "fail",
        message: "Search query is required",
      });
    }

    const searchQuery = query.trim();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const fetchWindow = Math.min(200, skip + limitNum);

    // Common projection for all models
    const baseProjection = {
      title: 1,
      mainUrl: 1,
      newsId: 1,
      category: 1,
      createdAt: 1,
      postedBy: 1,
      reactionsCount: 1,
      commentsCount: 1,
      description: 1,
      galleryPics: 1,
    };

    // Build base filter for text search
    const baseFilter = { $text: { $search: searchQuery } };
    // console.log("MongoDB text search filter:", baseFilter);

    // Add category filter if provided
    if (category && category !== "all") {
      baseFilter["category.en"] = category;
    }

    // Add time filter if provided
    if (time && time !== "all") {
      const dateFilter = getDateFilter(time);
      if (dateFilter) {
        baseFilter.createdAt = dateFilter;
      }
    }

    // console.log("Final filter:", JSON.stringify(baseFilter, null, 2));

    let results = [];
    let totalCount = 0;

    // Search based on type
    if (type === "all") {
      // Search across all three models in parallel
      const [newsPromise, galleryPromise, videoPromise] = await Promise.all([
        News.find(baseFilter)
          .sort({ score: { $meta: "textScore" } })
          .limit(fetchWindow)
          .select(baseProjection)
          .populate("postedBy", "fullName profileUrl")
          .lean(),
        Gallery.find(baseFilter)
          .sort({ score: { $meta: "textScore" } })
          .limit(fetchWindow)
          .select(baseProjection)
          .populate("postedBy", "fullName profileUrl")
          .lean(),
        Video.find(baseFilter) // Fixed: Changed from Videos to Video
          .sort({ score: { $meta: "textScore" } })
          .limit(fetchWindow)
          .select(baseProjection)
          .populate("postedBy", "fullName profileUrl")
          .lean(),
      ]);

      // console.log("News results count:", newsPromise.length);
      // console.log("Gallery results count:", galleryPromise.length);
      // console.log("Video results count:", videoPromise.length);

      // Combine and mix results from all models
      const allResults = [
        ...newsPromise.map((item) => ({ ...item, type: "news" })),
        ...galleryPromise.map((item) => ({ ...item, type: "gallery" })),
        ...videoPromise.map((item) => ({ ...item, type: "video" })),
      ];

      // console.log("Total combined results before pagination:", allResults.length);

      // Sort combined results by relevance score and date
      allResults.sort((a, b) => {
        // If MongoDB text score is available, use it
        if (a.score !== undefined && b.score !== undefined) {
          return b.score - a.score;
        }
        // Otherwise sort by date
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // Get total count
      const [newsCount, galleryCount, videoCount] = await Promise.all([
        News.countDocuments(baseFilter),
        Gallery.countDocuments(baseFilter),
        Video.countDocuments(baseFilter), // Fixed: Changed from Videos to Video
      ]);

      totalCount = newsCount + galleryCount + videoCount;
      // console.log("Total counts:", { newsCount, galleryCount, videoCount, totalCount });

      // Apply pagination
      results = allResults.slice(skip, skip + limitNum);
      // console.log("Results after pagination:", results.length);
    } else {
      // Search in specific model only
      let Model;
      switch (type) {
        case "news":
          Model = News;
          break;
        case "gallery":
          Model = Gallery;
          break;
        case "video":
          Model = Video; // Fixed: Changed from Videos to Video
          break;
        default:
          Model = News;
      }

      const [modelResults, modelCount] = await Promise.all([
        Model.find(baseFilter)
          .sort({ score: { $meta: "textScore" } })
          .skip(skip)
          .limit(limitNum)
          .select(baseProjection)
          .populate("postedBy", "fullName profileUrl")
          .lean(),
        Model.countDocuments(baseFilter),
      ]);

      results = modelResults.map((item) => ({ ...item, type }));
      totalCount = modelCount;
      // console.log(`Single model (${type}) results:`, results.length);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // console.log("Final response - results count:", results.length);

    return res.status(200).json({
      status: "success",
      results,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalResults: totalCount,
        hasNext,
        hasPrev,
        resultsPerPage: limitNum,
      },
      searchInfo: {
        query: searchQuery,
        category: category || "all",
        time: time || "all",
        type,
      },
    });
  } catch (error) {
    console.error("Search Error:", error);

    // Handle specific MongoDB errors
    if (error.name === "MongoError" && error.code === 27) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid search query",
      });
    }

    return res.status(500).json({
      status: "fail",
      message: "Internal server error during search",
    });
  }
};

// Helper function to get model by type
const getModelByType = (type) => {
  switch (type) {
    case "news":
      return News;
    case "gallery":
      return Gallery;
    case "video":
      return Video;
    default:
      return News;
  }
};

// Optimized Search for Large Datasets
export const getSearchedNewsOptimized = async (req, res) => {
  try {
    const {
      query,
      category,
      time,
      page = 1,
      limit = 10,
      type = "all",
    } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        status: "fail",
        message: "Search query is required",
      });
    }

    const searchQuery = query.trim();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const fetchWindow = Math.min(200, skip + limitNum);

    const baseFilter = { $text: { $search: searchQuery } };

    if (category && category !== "all") {
      baseFilter["category.en"] = category;
    }

    if (time && time !== "all") {
      const dateFilter = getDateFilter(time);
      if (dateFilter) {
        baseFilter.createdAt = dateFilter;
      }
    }

    const baseProjection = {
      title: 1,
      mainUrl: 1,
      newsId: 1,
      category: 1,
      createdAt: 1,
      postedBy: 1,
      reactionsCount: 1,
      commentsCount: 1,
    };

    if (type !== "all") {
      // Single model search
      const Model = getModelByType(type);
      const [results, totalCount] = await Promise.all([
        Model.find(baseFilter)
          .sort({ score: { $meta: "textScore" } })
          .skip(skip)
          .limit(limitNum)
          .select(baseProjection)
          .populate("postedBy", "fullName profileUrl")
          .lean(),
        Model.countDocuments(baseFilter),
      ]);

      const formattedResults = results.map((item) => ({ ...item, type }));

      return res.status(200).json({
        status: "success",
        results: formattedResults,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalResults: totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1,
        },
      });
    }

    // Multi-model search with distributed pagination
    const models = [
      { model: News, type: "news", limit: Math.ceil(limitNum / 2) },
      { model: Gallery, type: "gallery", limit: Math.ceil(limitNum / 3) },
      { model: Video, type: "video", limit: Math.ceil(limitNum / 3) },
    ];

    // Search each model with their respective limits
    const searchPromises = models.map(({ model, type, limit }) =>
      model
        .find(baseFilter)
        .sort({ score: { $meta: "textScore" } })
        .limit(Math.min(fetchWindow, limit))
        .select(baseProjection)
        .populate("postedBy", "fullName profileUrl")
        .lean()
        .then((results) => results.map((item) => ({ ...item, type })))
    );

    const [newsResults, galleryResults, videoResults] = await Promise.all(
      searchPromises
    );

    // Combine and sort all results
    const allResults = [...newsResults, ...galleryResults, ...videoResults]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limitNum);

    // Get total counts for pagination
    const countPromises = models.map(({ model }) =>
      model.countDocuments(baseFilter)
    );
    const [newsCount, galleryCount, videoCount] = await Promise.all(
      countPromises
    );
    const totalCount = newsCount + galleryCount + videoCount;

    return res.status(200).json({
      status: "success",
      results: allResults,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalResults: totalCount,
        hasNext: pageNum < Math.ceil(totalCount / limitNum),
        hasPrev: pageNum > 1,
      },
      searchInfo: {
        query: searchQuery,
        category: category || "all",
        time: time || "all",
        type: "all",
      },
    });
  } catch (error) {
    console.error("Optimized Search Error:", error);
    return res.status(500).json({
      status: "fail",
      message: "Internal server error during search",
    });
  }
};
