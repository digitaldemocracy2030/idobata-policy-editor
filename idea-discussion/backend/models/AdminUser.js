import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "editor"],
      default: "editor",
    },
    googleId: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

adminUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const pepperPassword = this.password + process.env.PASSWORD_PEPPER;

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pepperPassword, salt);

    this.password = hash;
    next();
  } catch (error) {
    next(error);
  }
});

adminUserSchema.methods.comparePassword = async function (candidatePassword) {
  const pepperPassword = candidatePassword + process.env.PASSWORD_PEPPER;
  return bcrypt.compare(pepperPassword, this.password);
};

const AdminUser = mongoose.model("AdminUser", adminUserSchema);

export default AdminUser;
