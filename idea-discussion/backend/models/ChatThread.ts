import mongoose, { Schema } from "mongoose";
import { IChatMessage, IChatThread } from "../types/index.js";

const chatMessageSchema = new Schema<IChatMessage>({
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatThreadSchema = new Schema<IChatThread>(
  {
    themeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Theme",
    },
    messages: [chatMessageSchema],
    userId: {
      type: String,
      required: false,
    },
    sessionId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ChatThread = mongoose.model<IChatThread>("ChatThread", chatThreadSchema);

export default ChatThread;
