import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const unifiedUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true, // Allow null/undefined but enforce uniqueness when present
    },
    displayName: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "editor", "user"],
      default: "user",
    },
    googleId: {
      type: String,
      sparse: true, // Allow null/undefined but enforce uniqueness when present
    },
    profileImageUrl: {
      type: String,
    },
    legacyUserId: {
      type: String,
      sparse: true, // Allow null/undefined but enforce uniqueness when present
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

unifiedUserSchema.index({ email: 1 }, { unique: true, sparse: true });
unifiedUserSchema.index({ googleId: 1 }, { unique: true, sparse: true });
unifiedUserSchema.index({ legacyUserId: 1 }, { unique: true, sparse: true });

unifiedUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(
      this.password + process.env.PASSWORD_PEPPER,
      salt
    );
    next();
  } catch (error) {
    next(error);
  }
});

unifiedUserSchema.methods.comparePassword = async function (password) {
  try {
    return await bcrypt.compare(
      password + process.env.PASSWORD_PEPPER,
      this.password
    );
  } catch (error) {
    throw new Error(error);
  }
};

unifiedUserSchema.methods.generateAuthToken = function () {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
  };
};

unifiedUserSchema.statics.findOrCreateByLegacyId = async function (
  legacyUserId,
  userData = {}
) {
  let user = await this.findOne({ legacyUserId });

  if (!user) {
    user = new this({
      legacyUserId,
      displayName: userData.displayName,
      profileImageUrl: userData.profileImageUrl,
      role: "user",
    });
    await user.save();
  }

  return user;
};

unifiedUserSchema.statics.findOrCreateByGoogleId = async function (
  googleId,
  userData = {}
) {
  let user = await this.findOne({ googleId });

  if (!user) {
    if (userData.email) {
      user = await this.findOne({ email: userData.email });
      if (user) {
        user.googleId = googleId;
        if (!user.profileImageUrl && userData.profileImageUrl) {
          user.profileImageUrl = userData.profileImageUrl;
        }
        await user.save();
        return user;
      }
    }

    const isFirstUser = (await this.countDocuments()) === 0;
    user = new this({
      googleId,
      email: userData.email,
      displayName: userData.displayName,
      profileImageUrl: userData.profileImageUrl,
      password: crypto.randomBytes(16).toString("hex"),
      role: isFirstUser ? "admin" : "user",
    });
    await user.save();
  }

  return user;
};

const UnifiedUser = mongoose.model("UnifiedUser", unifiedUserSchema);

export default UnifiedUser;
