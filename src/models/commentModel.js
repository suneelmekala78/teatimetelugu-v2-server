import mongoose, { Schema } from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    news: {
      type: Schema.Types.ObjectId,
      ref: "News", // proper relation
      required: true,
      index: true,
    },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // consistent with your User model
      required: true,
    },
    comment: {
      type: String,
      required: [true, "Comment text is required!"],
      trim: true,
    },
    language: {
      type: String,
      enum: ["en", "te"], // English or Telugu
      required: true,
      index: true,
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment", // self-reference for threading
      default: null,
      index: true,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dislikes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// ✅ Index for fast retrieval of comments on a news item
commentSchema.index({ news: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
