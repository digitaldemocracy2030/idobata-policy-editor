import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
    },
    role: {
      type: String,
      enum: ["admin", "editor"],
      default: "editor",
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
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

adminUserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const AdminUser = mongoose.model("AdminUser", adminUserSchema);

export default AdminUser;
