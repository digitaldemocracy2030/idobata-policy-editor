import mongoose, { Schema } from "mongoose";
import { ISharpQuestion } from "../types/index.js";

const sharpQuestionSchema = new Schema<ISharpQuestion>(
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
    order: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true }
);

const SharpQuestion = mongoose.model<ISharpQuestion>(
  "SharpQuestion",
  sharpQuestionSchema
);

export default SharpQuestion;
