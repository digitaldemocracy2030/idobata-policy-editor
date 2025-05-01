import mongoose, { Schema } from "mongoose";
import { ISolution } from "../types/index.js";

const solutionSchema = new Schema<ISolution>(
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

const Solution = mongoose.model<ISolution>("Solution", solutionSchema);

export default Solution;
