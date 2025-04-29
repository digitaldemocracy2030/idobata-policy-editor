import bcrypt from "bcryptjs";
import AdminUser from "../models/AdminUser.js";
import authService from "../services/auth/authService.js";

const initializeAdminUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "名前、メールアドレス、パスワードを入力してください",
      });
    }

    const existingAdmins = await AdminUser.find({ role: "admin" });
    if (existingAdmins.length > 0) {
      return res.status(400).json({
        message: "管理者ユーザーは既に初期化されています",
      });
    }

    const user = await AdminUser.create({
      name,
      email,
      password,
      role: "admin",
    });

    const { token } = await authService.authenticate("local", {
      email,
      password,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: Number.parseInt(process.env.JWT_EXPIRES_IN || "86400") * 1000, // ミリ秒に変換
      path: "/",
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Initialize admin user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        message: "メールアドレスとパスワードを入力してください",
      });
    }

    try {
      const { user, token } = await authService.authenticate("local", {
        email,
        password,
      });

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: Number.parseInt(process.env.JWT_EXPIRES_IN || "86400") * 1000, // ミリ秒に変換
        path: "/",
      });

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("[AuthController] Authentication error:", error);
      return res.status(401).json({ message: "認証に失敗しました" });
    }
  } catch (error) {
    console.error("[AuthController] Login error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await AdminUser.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "ユーザーが見つかりません" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Get current user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const createAdminUser = async (req, res) => {
  try {
    const { name, email, password, role = "editor" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "名前、メールアドレス、パスワードを入力してください",
      });
    }

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "このメールアドレスは既に使用されています",
      });
    }

    const user = await AdminUser.create({
      name,
      email,
      password,
      role,
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Create admin user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const logout = (req, res) => {
  res.cookie("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    expires: new Date(0),
    path: "/",
  });

  res.json({ message: "ログアウトしました" });
};

export { login, getCurrentUser, createAdminUser, initializeAdminUser, logout };
