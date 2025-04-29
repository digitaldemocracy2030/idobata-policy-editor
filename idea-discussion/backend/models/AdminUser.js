import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "名前は必須です"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "メールアドレスは必須です"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "有効なメールアドレスを入力してください",
      ],
    },
    password: {
      type: String,
      required: [true, "パスワードは必須です"],
      minlength: [8, "パスワードは8文字以上である必要があります"],
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
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const pepperPassword = this.password + process.env.PASSWORD_PEPPER;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(pepperPassword, salt);
    next();
  } catch (error) {
    next(error);
  }
});

adminUserSchema.methods.matchPassword = async function (enteredPassword) {
  const pepperPassword = enteredPassword + process.env.PASSWORD_PEPPER;
  return await bcrypt.compare(pepperPassword, this.password);
};

const AdminUser = mongoose.model("AdminUser", adminUserSchema);

export default AdminUser;
