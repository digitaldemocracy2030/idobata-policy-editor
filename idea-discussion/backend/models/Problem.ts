import mongoose, { Schema } from "mongoose";
import { IProblem } from "../types/index.js";

const problemSchema = new Schema<IProblem>(
  {
    themeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Theme",
    },
    content: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
    },
    extractedFrom: {
      type: Schema.Types.ObjectId,
      required: false,
      ref: "ChatThread",
    },
  },
  { timestamps: true }
);

const Problem = mongoose.model<IProblem>("Problem", problemSchema);

export default Problem;
