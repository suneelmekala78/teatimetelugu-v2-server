import sanitizeHtml from "sanitize-html";
import Gallery from "../models/galleryModel.js";
import Users from "../models/userModel.js";
import { uploadFile, deleteFile } from "../utils/s3Service.js";
import { generateUniqueSlug } from "../utils/generateUniqueSlug.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { generateAudioForTexts } from "../utils/audio.js";

export const addGallery = async (req, res) => {
  try {
    const {
      titleEn,
      titleTe,
      nameEn,
      nameTe,
      descriptionEn,
      descriptionTe,
      categoryEn,
      categoryTe,
      tagsEn,
      tagsTe,
    } = req.body;

    const { user } = req.user;

    // ✅ Required fields
    if (!titleEn || !titleTe)
      return res
        .status(400)
        .json({ status: "fail", message: "Both titles required!" });
    if (!nameEn || !nameTe)
      return res
        .status(400)
        .json({ status: "fail", message: "Both names required!" });
    if (!descriptionEn || !descriptionTe)
      return res
        .status(400)
        .json({ status: "fail", message: "Both descriptions required!" });
    if (!categoryEn || !categoryTe)
      return res
        .status(400)
        .json({ status: "fail", message: "Both categories required!" });

    if (!user)
      return res
        .status(404)
        .json({ status: "fail", message: "User not found!" });

    const currentUser = await Users.findById(user?._id);
    if (
      (currentUser.role !== "admin" && currentUser.role !== "writer") ||
      currentUser.isActive === false
    ) {
      return res
        .status(403)
        .json({ status: "fail", message: "You don't have permission!" });
    }

    // ✅ sanitize & prepare dual descriptions
    const enHtml = sanitizeHtml(descriptionEn, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    });
    const teHtml = sanitizeHtml(descriptionTe, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    });

    const enText = sanitizeHtml(descriptionEn, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
    const teText = sanitizeHtml(descriptionTe, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();

    // ✅ Upload gallery images
    const galleryPics = [];
    for (const file of req.files) {
      const uploadResult = await uploadFile(file);
      galleryPics.push(uploadResult.Location);
    }

    // ✅ Generate unique slug
    const newsId = await generateUniqueSlug(Gallery, titleEn);
    
    if (!newsId) {
      return res.status(500).json({
        status: "fail",
        message: "Failed to generate unique newsId",
      });
    }
    
    const audioFiles = await generateAudioForTexts({
      enTitle: titleEn,
      enDescription: enText,
      teTitle: titleTe,
      teDescription: teText,
    });

    const newPost = new Gallery({
      postedBy: user?._id,
      title: { en: titleEn, te: titleTe },
      name: { en: nameEn, te: nameTe },
      description: {
        en: { text: enText, withTags: enHtml },
        te: { text: teText, withTags: teHtml },
      },
      category: { en: categoryEn, te: categoryTe },
      newsAudio: {
        en: audioFiles.en,
        te: audioFiles.te,
      },
      tags: [
        ...(tagsEn
          ? tagsEn.split(",").map((t) => ({ en: t.trim(), te: "" }))
          : []),
        ...(tagsTe
          ? tagsTe.split(",").map((t) => ({ en: "", te: t.trim() }))
          : []),
      ],
      galleryPics,
      newsId,
    });

    await newPost.save();

    res.status(201).json({
      status: "success",
      message: "Gallery added successfully",
      gallery: newPost,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};

export const addReaction = async (req, res) => {
  try {
    const { galleryId } = req.params;
    const { type } = req.body;
    const userId = req.user.user._id;

    if (!galleryId) {
      return res
        .status(404)
        .send({ status: "fail", message: "Gallery id not found!" });
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

    const gallery = await Gallery.findById(galleryId);
    if (!gallery) {
      return res
        .status(404)
        .send({ status: "fail", message: "Gallery post not found" });
    }

    const existingReactionIndex = gallery.reactions.findIndex(
      (reaction) => reaction.userId.toString() === userId.toString()
    );

    if (existingReactionIndex >= 0) {
      gallery.reactions[existingReactionIndex].type = type;
    } else {
      gallery.reactions.push({ userId, type });
      await Gallery.findByIdAndUpdate(galleryId, {
        $inc: { reactionsCount: 1 },
      });
    }

    await gallery.save();

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

// Get gallery by ID
export const getGalleryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res
        .status(400)
        .json({ status: "fail", message: "ID is required" });

    const gallery = await Gallery.findById(id)
      .populate("postedBy", "fullName profileUrl _id")
      .lean(); // faster, plain JS object

    if (!gallery)
      return res
        .status(404)
        .json({ status: "fail", message: "Gallery not found" });

    return res.status(200).json({ status: "success", data: gallery });
  } catch (error) {
    console.error("Error in getGalleryById:", error);
    return res
      .status(500)
      .json({ status: "fail", message: "Server Error", error: error.message });
  }
};

// Get gallery by newsId with suggested galleries
export const getGalleryByNewsId = async (req, res) => {
  try {
    const { newsId } = req.params;
    if (!newsId)
      return res
        .status(400)
        .json({ status: "fail", message: "newsId parameter is required" });

    const gallery = await Gallery.findOne({ newsId })
      .populate("postedBy", "fullName profileUrl")
      .lean();

    if (!gallery)
      return res
        .status(404)
        .json({ status: "fail", message: "Gallery not found" });

    // Suggested galleries (recent week, excluding current)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const suggestedGallery = await Gallery.aggregate([
      { $match: { newsId: { $ne: newsId }, createdAt: { $gte: oneWeekAgo } } },
      { $sample: { size: 20 } },
      {
        $project: {
          title: 1,
          name: 1,
          galleryPics: 1,
          newsId: 1,
          createdAt: 1,
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      gallery,
      suggestedGallery,
    });
  } catch (error) {
    console.error("Error fetching gallery by newsId:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the gallery",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get filtered gallery with pagination
export const getFilteredGallery = async (req, res) => {
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

    // Category filter
    if (category) {
      const safeCat = escapeRegex(category);
      filter.$or = [
        { "category.en": { $regex: safeCat, $options: "i" } },
        { "category.te": { $regex: safeCat, $options: "i" } },
      ];
    }

    // Writer filter
    if (writer && mongoose.Types.ObjectId.isValid(writer)) {
      filter.postedBy = mongoose.Types.ObjectId(writer);
    }

    // Search filter
    if (searchText) {
      const safeSearch = escapeRegex(searchText);
      filter.$or = [
        { "title.en": { $regex: safeSearch, $options: "i" } },
        { "title.te": { $regex: safeSearch, $options: "i" } },
        { "description.en.text": { $regex: safeSearch, $options: "i" } },
        { "description.te.text": { $regex: safeSearch, $options: "i" } },
        { "tags.en": { $regex: safeSearch, $options: "i" } },
        { "tags.te": { $regex: safeSearch, $options: "i" } },
      ];
    }

    // Time filter
    if (time) {
      const now = new Date();
      let fromDate;

      const timeMap = {
        "24h": 1 / 24,
        week: 7,
        month: 30,
        "6months": 180,
        "1year": 365,
        "2years": 730,
        "3years": 1095,
      };

      if (timeMap[time]) {
        fromDate = new Date(
          now.getTime() - timeMap[time] * 24 * 60 * 60 * 1000
        );
        filter.createdAt = { $gte: fromDate };
      }

      const aboveMap = {
        above6months: 180,
        above1year: 365,
        above2years: 730,
        above3years: 1095,
      };

      if (aboveMap[time]) {
        fromDate = new Date(
          now.getTime() - aboveMap[time] * 24 * 60 * 60 * 1000
        );
        filter.createdAt = { $lt: fromDate };
      }
    }

    const totalItems = await Gallery.countDocuments(filter);

    const galleries = await Gallery.find(filter)
      .populate("postedBy", "fullName profileUrl")
      .select(
        "title name category galleryPics description tags newsId createdAt"
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      status: "success",
      gallery: galleries,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching filtered gallery:", error);
    return res
      .status(500)
      .json({ status: "fail", message: "Server error", error: error.message });
  }
};

export const editGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titleEn,
      titleTe,
      nameEn,
      nameTe,
      descriptionEn,
      descriptionTe,
      categoryEn,
      categoryTe,
      tagsEn,
      tagsTe,
      removedImages, // JSON string or array
    } = req.body;

    const { user } = req.user;

    if (!id) {
      return res
        .status(400)
        .json({ status: "fail", message: "ID is required" });
    }

    // ✅ Parse removed images safely
    let imagesToRemove = [];
    try {
      if (removedImages) {
        imagesToRemove = JSON.parse(removedImages);
      }
    } catch {
      if (typeof removedImages === "string") imagesToRemove = [removedImages];
      else if (Array.isArray(removedImages)) imagesToRemove = removedImages;
    }

    // ✅ Required fields validation
    if (
      !titleEn ||
      !titleTe ||
      !nameEn ||
      !nameTe ||
      !descriptionEn ||
      !descriptionTe ||
      !categoryEn ||
      !categoryTe
    ) {
      return res
        .status(400)
        .json({ status: "fail", message: "All fields required!" });
    }

    // ✅ User validation
    if (!user) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found!" });
    }

    const currentUser = await Users.findById(user._id);
    if (!currentUser || currentUser.isActive === false) {
      return res
        .status(403)
        .json({ status: "fail", message: "User not authorized!" });
    }

    if (currentUser.role !== "admin" && currentUser.role !== "writer") {
      return res
        .status(403)
        .json({ status: "fail", message: "Permission denied!" });
    }

    // ✅ sanitize & prepare dual descriptions
    const enHtml = sanitizeHtml(descriptionEn, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    });
    const teHtml = sanitizeHtml(descriptionTe, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
    });

    const enText = sanitizeHtml(descriptionEn, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
    const teText = sanitizeHtml(descriptionTe, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();

    // ✅ Gallery check
    const gallery = await Gallery.findById(id);
    if (!gallery) {
      return res
        .status(404)
        .json({ status: "fail", message: "Gallery not found!" });
    }

    // ✅ Remove images if requested
    if (imagesToRemove.length > 0) {
      gallery.galleryPics = gallery.galleryPics.filter((img) => {
        const imageUrl = typeof img === "string" ? img : img.url;
        return !imagesToRemove.includes(imageUrl);
      });

      for (const imgUrl of imagesToRemove) {
        try {
          await deleteFile(imgUrl); // S3 delete
        } catch (err) {
          console.error("Image delete error:", err.message);
        }
      }
    }

    // ✅ Upload new files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadFile(file); // S3 upload
          gallery.galleryPics.push(uploadResult.Location);
        } catch (uploadError) {
          console.error("File upload failed:", uploadError.message);
        }
      }
    }

    // ✅ Update text fields
    gallery.title = { en: titleEn, te: titleTe };
    gallery.name = { en: nameEn, te: nameTe };
    gallery.description = {
      en: { text: enText, withTags: enHtml },
      te: { text: teText, withTags: teHtml },
    };
    gallery.category = { en: categoryEn, te: categoryTe };

    // ✅ Handle tags (combine en + te properly)
    const englishTags = tagsEn
      ? tagsEn
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const teluguTags = tagsTe
      ? tagsTe
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    gallery.tags = [
      ...englishTags.map((t) => ({ en: t, te: "" })),
      ...teluguTags.map((t) => ({ en: "", te: t })),
    ];

    // ✅ Regenerate slug if title changed
    if (gallery.title.en !== titleEn) {
      const galleryId = await generateUniqueSlug(Gallery, titleEn, id);
      gallery.newsId = galleryId;
    }

    // ✅ Reset and regenerate audio
    gallery.newsAudio = null;

    const audioFiles = await generateAudioForTexts({
      enTitle: titleEn,
      enDescription: descriptionEn,
      teTitle: titleTe,
      teDescription: descriptionTe,
    });

    gallery.newsAudio = audioFiles;

    await gallery.save();

    res.status(200).json({
      status: "success",
      message: "Gallery updated successfully",
      gallery,
    });
  } catch (error) {
    console.error("Edit Gallery Error:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

export const deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.user;

    if (!user)
      return res
        .status(404)
        .json({ status: "fail", message: "User not found!" });

    const currentUser = await Users.findById(user._id);
    if (
      (currentUser.role !== "admin" && currentUser.role !== "writer") ||
      currentUser.isActive === false
    ) {
      return res
        .status(403)
        .json({ status: "fail", message: "You don't have permission!" });
    }

    const gallery = await Gallery.findById(id);
    if (!gallery)
      return res
        .status(404)
        .json({ status: "fail", message: "Gallery not found!" });

    // ✅ Delete images from S3
    for (const img of gallery.galleryPics) {
      try {
        await deleteFile(img.url);
      } catch (err) {
        console.log("AWS delete error:", err.message);
      }
    }

    await Gallery.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Gallery deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "fail", message: error.message });
  }
};
