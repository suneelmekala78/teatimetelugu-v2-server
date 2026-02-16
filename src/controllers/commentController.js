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

// ✅ Recursive function to get nested replies
const getRepliesRecursive = async (commentId) => {
  const replies = await Comment.find({ parentComment: commentId })
    .populate("postedBy", "fullName profileUrl")
    .sort({ createdAt: -1 });

  const nestedReplies = await Promise.all(
    replies.map(async (reply) => {
      const children = await getRepliesRecursive(reply._id);
      return { ...reply.toObject(), replies: children };
    })
  );

  return nestedReplies;
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
        "Valid language (en/te) is required!"
      );

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Top-level comments only
    const topComments = await Comment.find({
      news: newsId, 
      language,
      parentComment: null,
    })
      .populate("postedBy", "fullName profileUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Fetch nested replies recursively
    const commentsWithReplies = await Promise.all(
      topComments.map(async (comment) => {
        const replies = await getRepliesRecursive(comment._id);
        return { ...comment.toObject(), replies };
      })
    );

    const totalComments = await Comment.countDocuments({
      news: newsId,
      language,
      parentComment: null,
    });

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
        "Valid language (en/te) is required!"
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

    return sendResponse(
      res,
      201,
      "success",
      "Reply added successfully!",
      newReply
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
        "Valid language (en/te) is required!"
      );

    const newComment = await Comment.create({
      news: newsId,
      postedBy: userId,
      comment,
      language,
    });

    return sendResponse(
      res,
      201,
      "success",
      "Comment added successfully!",
      newComment
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
        "You are not allowed to delete this comment"
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
      hasLiked ? "Like removed" : "Liked successfully"
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
      hasDisliked ? "Dislike removed" : "Disliked successfully"
    );
  } catch (error) {
    console.error("dislikeComment error:", error);
    return sendResponse(res, 500, "fail", error.message);
  }
};
