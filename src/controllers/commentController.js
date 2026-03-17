import Comment from "../models/commentModel.js";

// ✅ Helper: validate language
const isValidLanguage = (lang) => ["en", "te"].includes(lang);

// ✅ Utility: standard API response
const sendResponse = (res, statusCode, status, message, data = null) => {
  return res.status(statusCode).json({
    status,
    message,
    ...(data && { data }),
  });
};

// Flat query for all replies under given comment IDs, then nest in memory
const buildReplyTree = (allReplies, parentId) => {
  return allReplies
    .filter((r) => String(r.parentComment) === String(parentId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({ ...r, replies: buildReplyTree(allReplies, r._id) }));
};

const getRepliesForComments = async (commentIds) => {
  if (!commentIds.length) return new Map();

  // Single query: fetch ALL nested replies for these top-level comments
  const allReplies = await Comment.find({
    $or: commentIds.map((id) => ({ parentComment: id })),
  })
    .populate("postedBy", "fullName profileUrl")
    .lean();

  // If replies have their own replies, fetch those too (max 2 levels deep)
  if (allReplies.length) {
    const replyIds = allReplies.map((r) => r._id);
    const nestedReplies = await Comment.find({
      parentComment: { $in: replyIds },
    })
      .populate("postedBy", "fullName profileUrl")
      .lean();
    allReplies.push(...nestedReplies);
  }

  // Build nested tree per top-level comment
  const map = new Map();
  for (const id of commentIds) {
    map.set(String(id), buildReplyTree(allReplies, id));
  }
  return map;
};

// ✅ Get comments by newsId + language (with nested replies)
export const getComments = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { language, page = 1, limit = 10 } = req.query;

    if (!newsId) return sendResponse(res, 400, "fail", "News ID is required!");
    if (!isValidLanguage(language))
      return sendResponse(
        res,
        400,
        "fail",
        "Valid language (en/te) is required!",
      );

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Top-level comments + count in parallel
    const [topComments, totalComments] = await Promise.all([
      Comment.find({
        news: newsId,
        language,
        parentComment: null,
      })
        .populate("postedBy", "fullName profileUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Comment.countDocuments({
        news: newsId,
        language,
        parentComment: null,
      }),
    ]);

    // Batch-fetch all replies (max 2 levels) in 1-2 queries instead of N+1
    const commentIds = topComments.map((c) => c._id);
    const replyMap = await getRepliesForComments(commentIds);

    const commentsWithReplies = topComments.map((comment) => ({
      ...comment,
      replies: replyMap.get(String(comment._id)) || [],
    }));

    return sendResponse(res, 200, "success", "Comments fetched successfully", {
      comments: commentsWithReplies,
      pagination: {
        total: totalComments,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalComments / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getComments Error:", error);
    return sendResponse(res, 500, "fail", error.message);
  }
};

// ✅ Add a reply (nested)
export const addReplyComment = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { parentCommentId, comment, language } = req.body;
    const userId = req.user.user?._id;

    if (!parentCommentId)
      return sendResponse(res, 400, "fail", "Parent comment ID is required!");
    if (!comment) return sendResponse(res, 400, "fail", "Write something!");
    if (!isValidLanguage(language))
      return sendResponse(
        res,
        400,
        "fail",
        "Valid language (en/te) is required!",
      );

    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment)
      return sendResponse(res, 404, "fail", "Parent comment not found");

    const newReply = await Comment.create({
      news: newsId,
      parentComment: parentCommentId,
      postedBy: userId,
      comment,
      language,
    });

    const populatedComment = await Comment.findById(newReply._id)
      .populate({
        path: "postedBy",
        select: "fullName profileUrl",
      })
      .lean();

    return sendResponse(
      res,
      201,
      "success",
      "Reply added successfully!",
      populatedComment,
    );
  } catch (error) {
    console.error("addReplyComment error:", error);
    return sendResponse(res, 500, "fail", error.message);
  }
};

// ✅ Add a top-level comment
export const addComment = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { comment, language } = req.body;
    const userId = req.user.user?._id;

    if (!newsId) return sendResponse(res, 400, "fail", "News ID is required!");
    if (!comment) return sendResponse(res, 400, "fail", "Write something!");
    if (!isValidLanguage(language))
      return sendResponse(
        res,
        400,
        "fail",
        "Valid language (en/te) is required!",
      );

    const newComment = await Comment.create({
      news: newsId,
      postedBy: userId,
      comment,
      language,
    });

    /* populate user info BEFORE sending */
    const populatedComment = await Comment.findById(newComment._id)
      .populate({
        path: "postedBy",
        select: "fullName profileUrl", // only what UI needs
      })
      .lean();

    return sendResponse(
      res,
      201,
      "success",
      "Comment added successfully!",
      populatedComment,
    );
  } catch (error) {
    console.error("addComment error:", error);
    return sendResponse(res, 500, "fail", error.message);
  }
};

// ✅ Delete comment (cascade delete replies)
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.user?._id;

    if (!commentId)
      return sendResponse(res, 400, "fail", "Comment ID is required!");

    const comment = await Comment.findById(commentId);
    if (!comment) return sendResponse(res, 404, "fail", "Comment not found");

    if (String(comment.postedBy) !== String(userId)) {
      return sendResponse(
        res,
        403,
        "fail",
        "You are not allowed to delete this comment",
      );
    }

    // Delete replies recursively
    await Comment.deleteMany({ parentComment: commentId });
    await Comment.findByIdAndDelete(commentId);

    return sendResponse(res, 200, "success", "Comment deleted successfully");
  } catch (error) {
    console.error("deleteComment error:", error);
    return sendResponse(res, 500, "fail", error.message);
  }
};

// ✅ Like / Unlike comment
export const likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.user?._id;

    const comment = await Comment.findById(commentId);
    if (!comment) return sendResponse(res, 404, "fail", "Comment not found");

    const hasLiked = comment.likes.includes(userId);
    if (hasLiked) {
      comment.likes.pull(userId);
    } else {
      comment.dislikes.pull(userId);
      comment.likes.push(userId);
    }

    await comment.save();

    return sendResponse(
      res,
      200,
      "success",
      hasLiked ? "Like removed" : "Liked successfully",
    );
  } catch (error) {
    console.error("likeComment error:", error);
    return sendResponse(res, 500, "fail", error.message);
  }
};

// ✅ Dislike / Remove dislike
export const dislikeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.user?._id;

    const comment = await Comment.findById(commentId);
    if (!comment) return sendResponse(res, 404, "fail", "Comment not found");

    const hasDisliked = comment.dislikes.includes(userId);
    if (hasDisliked) {
      comment.dislikes.pull(userId);
    } else {
      comment.likes.pull(userId);
      comment.dislikes.push(userId);
    }

    await comment.save();

    return sendResponse(
      res,
      200,
      "success",
      hasDisliked ? "Dislike removed" : "Disliked successfully",
    );
  } catch (error) {
    console.error("dislikeComment error:", error);
    return sendResponse(res, 500, "fail", error.message);
  }
};
