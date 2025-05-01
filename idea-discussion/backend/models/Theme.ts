import mongoose, { Schema } from "mongoose";
import { ITheme } from "../types/index.js";

const themeSchema = new Schema<ITheme>(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: false,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Theme = mongoose.model<ITheme>("Theme", themeSchema);

export default Theme;
