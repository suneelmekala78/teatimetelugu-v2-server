import mongoose from "mongoose";
import Videos from "../models/videoModel.js";
import { generateUniqueSlug } from "../utils/generateUniqueSlug.js";

/**
 * @desc Add a new video
 */
export const addVideo = async (req, res) => {
  try {
    const { title, ytId, subCategory } = req.body;
    const { user } = req.user; // ✅ directly from middleware

    if (!title?.en || !title?.te || !ytId) {
      return res.status(400).json({
        status: "fail",
        message: "English & Telugu titles and YouTube ID are required!",
      });
    }

    if (!["admin", "writer"].includes(user?.role) || user?.isActive === false) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to add videos.",
      });
    }

    const newsId = await generateUniqueSlug(Videos, title.en);

    const newVideo = new Videos({
      postedBy: user._id,
      title,
      newsId,
      mainUrl: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
      videoUrl: `https://www.youtube.com/embed/${ytId}`,
      subCategory,
    });

    await newVideo.save();

    return res.status(201).json({
      status: "success",
      message: "Video added successfully",
      data: newVideo,
    });
  } catch (error) {
    console.error("Error adding video:", error);
    return res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
};

/**
 * @desc Delete a video
 */
export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.user;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "Video ID is required",
      });
    }

    if (!["admin", "writer"].includes(user?.role) || user?.isActive === false) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to delete videos.",
      });
    }

    const video = await Videos.findByIdAndDelete(id);

    if (!video) {
      return res.status(404).json({
        status: "fail",
        message: "Video not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Video deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting video:", error);
    return res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
};

/**
 * @desc Get filtered videos (category, writer, search, time-based filters, pagination)
 */
export const getFilteredVideos = async (req, res) => {
  try {
    let {
      category,
      time,
      searchText,
      writer,
      page = 1,
      limit = 10,
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};

    // ✅ Category filter
    if (category) {
      filter.$or = [
        { "category.en": { $regex: category, $options: "i" } },
        { "category.te": { $regex: category, $options: "i" } },
        { "subCategory.en": { $regex: category, $options: "i" } },
        { "subCategory.te": { $regex: category, $options: "i" } },
      ];
    }

    // ✅ Writer filter
    if (writer && mongoose.Types.ObjectId.isValid(writer)) {
      filter.postedBy = new mongoose.Types.ObjectId(writer);
    }

    // ✅ Search filter
    if (searchText) {
      filter.$or = [
        { "title.en": { $regex: searchText, $options: "i" } },
        { "title.te": { $regex: searchText, $options: "i" } },
      ];
    }

    // ✅ Time filter
    if (time) {
      const now = new Date();
      let fromDate;

      switch (time) {
        case "24h":
          fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          filter.createdAt = { $gte: fromDate };
          break;
        case "week":
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          filter.createdAt = { $gte: fromDate };
          break;
        case "month":
          fromDate = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            now.getDate()
          );
          filter.createdAt = { $gte: fromDate };
          break;
        case "6months":
          fromDate = new Date(
            now.getFullYear(),
            now.getMonth() - 6,
            now.getDate()
          );
          filter.createdAt = { $gte: fromDate };
          break;
        case "1year":
          fromDate = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate()
          );
          filter.createdAt = { $gte: fromDate };
          break;
        case "above6months":
          fromDate = new Date(
            now.getFullYear(),
            now.getMonth() - 6,
            now.getDate()
          );
          filter.createdAt = { $lt: fromDate };
          break;
        case "above1year":
          fromDate = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate()
          );
          filter.createdAt = { $lt: fromDate };
          break;
        default:
          break;
      }
    }

    const totalItems = await Videos.countDocuments(filter);

    const videos = await Videos.find(filter)
      .populate("postedBy", "fullName email profileUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      status: "success",
      videos,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching filtered videos:", error);
    return res.status(500).json({ status: "fail", message: "Server error" });
  }
};

/**
 * @desc Get single video by newsId + suggestions + similar
 */
export const getVideoByNewsId = async (req, res) => {
  try {
    const { newsId } = req.params;

    if (!newsId) {
      return res.status(400).json({
        status: "fail",
        message: "newsId parameter is required",
      });
    }

    const video = await Videos.findOne({ newsId })
      .populate("postedBy", "fullName profileUrl")
      .exec();

    if (!video) {
      return res.status(404).json({
        status: "fail",
        message: "Video not found!",
      });
    }

    // Extract key entities from title for better matching
    const titleKeywords = extractKeyEntities(video.title.en);
    
    // Get both similar videos and suggested videos in parallel for better performance
    const [similarVideos, suggestedVideos] = await Promise.all([
      getSimilarVideos(newsId, titleKeywords, video.category?.en),
      getSuggestedVideos(newsId)
    ]);

    return res.status(200).json({
      status: "success",
      message: "Video fetched successfully",
      video,
      suggestedVideos,
      similarVideos,
    });
  } catch (error) {
    console.error("Error fetching video by newsId:", error);
    return res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
};

// Helper function to extract key entities from title
const extractKeyEntities = (title) => {
  if (!title) return [];
  
  // Common words to exclude
  const stopWords = new Set([
    'trailer', 'official', 'video', 'movie', 'film', 'teaser', 'the', 'a', 'an', 
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
  ]);

  // Extract words and filter out stop words and short words
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !stopWords.has(word) &&
      !/\d/.test(word) // Remove pure numbers
    );

  return [...new Set(words)]; // Remove duplicates
};

// Improved similar videos query
const getSimilarVideos = async (currentNewsId, keywords, category) => {
  if (!keywords.length) {
    return await getFallbackVideos(currentNewsId, category);
  }

  // Build $or conditions for regex matching
  const orConditions = [];
  
  // Add conditions for each keyword in English title
  keywords.forEach(keyword => {
    orConditions.push(
      { "title.en": { $regex: keyword, $options: 'i' } }
    );
  });
  
  // Add conditions for each keyword in Telugu title
  keywords.forEach(keyword => {
    orConditions.push(
      { "title.te": { $regex: keyword, $options: 'i' } }
    );
  });
  
  // Add category match
  if (category) {
    orConditions.push({ "category.en": category });
  }

  const similarVideos = await Videos.aggregate([
    {
      $match: {
        newsId: { $ne: currentNewsId },
        $or: orConditions
      }
    },
    {
      $addFields: {
        // Calculate relevance score
        relevanceScore: {
          $add: [
            // Score for keyword matches in English title
            {
              $reduce: {
                input: keywords,
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        { $regexMatch: { input: "$title.en", regex: "$$this", options: "i" } },
                        10, // Weight for English title matches
                        0
                      ]
                    }
                  ]
                }
              }
            },
            // Score for keyword matches in Telugu title
            {
              $reduce: {
                input: keywords,
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        { $regexMatch: { input: "$title.te", regex: "$$this", options: "i" } },
                        8, // Slightly lower weight for Telugu matches
                        0
                      ]
                    }
                  ]
                }
              }
            },
            // Bonus for same category
            { $cond: [{ $eq: ["$category.en", category] }, 5, 0] },
            // Recency bonus (videos from last 7 days get higher score)
            {
              $cond: [
                { $gte: ["$createdAt", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                3,
                0
              ]
            }
          ]
        }
      }
    },
    { $sort: { relevanceScore: -1, createdAt: -1 } },
    { $limit: 9 }
  ]);

  // If we don't have enough relevant videos, add fallback
  if (similarVideos.length < 5) {
    const fallbackVideos = await getFallbackVideos(currentNewsId, category);
    const combined = [...similarVideos, ...fallbackVideos];
    
    // Remove duplicates and limit to 10
    const uniqueVideos = combined.reduce((acc, video) => {
      if (!acc.find(v => v.newsId === video.newsId) && acc.length < 10) {
        acc.push(video);
      }
      return acc;
    }, []);

    return uniqueVideos;
  }

  return similarVideos;
};

// Fallback to category-based videos when keyword matching is weak
const getFallbackVideos = async (currentNewsId, category) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const matchStage = {
    newsId: { $ne: currentNewsId },
    createdAt: { $gte: oneWeekAgo }
  };

  // Only add category filter if category exists
  if (category) {
    matchStage["category.en"] = category;
  }

  return await Videos.aggregate([
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    { $limit: 5 }
  ]);
};

// ✅ Suggested videos (random from last 7 days) - Keep your original logic
const getSuggestedVideos = async (currentNewsId) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return await Videos.aggregate([
    {
      $match: {
        newsId: { $ne: currentNewsId },
        createdAt: { $gte: oneWeekAgo },
      },
    },
    { $sample: { size: 20 } },
  ]);
};

/**
 * @desc Update a video
 */
export const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { title, ytId, category, subCategory } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "Video ID is required",
      });
    }

    if (!["admin", "writer"].includes(user?.role) || user?.isActive === false) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to update videos.",
      });
    }

    // Build update object
    const updateFields = {};

    if (title?.en && title?.te) updateFields.title = title;
    if (category?.en && category?.te) updateFields.category = category;
    if (subCategory?.en || subCategory?.te)
      updateFields.subCategory = subCategory;

    if (ytId) {
      updateFields.mainUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
      updateFields.videoUrl = `https://www.youtube.com/embed/${ytId}`;
    }

    const updatedVideo = await Videos.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedVideo) {
      return res.status(404).json({
        status: "fail",
        message: "Video not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Video updated successfully",
      data: updatedVideo,
    });
  } catch (error) {
    console.error("Error updating video:", error);
    return res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
};
