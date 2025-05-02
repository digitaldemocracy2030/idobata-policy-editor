import AdminUser from "../models/AdminUser.js";
import authService from "../services/auth/authService.js";

const initializeAdminUser = async (req, res) => {
  try {
    const adminCount = await AdminUser.countDocuments();

    if (adminCount > 0) {
      console.warn("[AuthController] 管理者が既に存在する状態で初期化が試行されました");
      return res.status(403).json({
        message: "管理者ユーザーは既に初期化されています",
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "名前、メールアドレス、パスワードは必須です",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "有効なメールアドレスを入力してください",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "パスワードは6文字以上である必要があります",
      });
    }

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "このメールアドレスは既に使用されています",
      });
    }

    const newUser = new AdminUser({
      name,
      email,
      password,
      role: "admin", // 初期ユーザーは常に管理者権限
    });

    await newUser.save();

    const newAdminCount = await AdminUser.countDocuments();
    if (newAdminCount > 1) {
      console.warn("[AuthController] 競合状態が検出されました: 複数の管理者が同時に作成された可能性があります");
    }

    console.info(`[AuthController] 初期管理者ユーザーが作成されました: ${email}`);
    res.status(201).json({
      message: "初期管理者ユーザーが正常に作成されました",
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
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

      res.json({
        token,
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
    const user = await AdminUser.findById(req.user.id);

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
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "名前、メールアドレス、パスワードは必須です",
      });
    }

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "このメールアドレスは既に使用されています",
      });
    }

    const newUser = new AdminUser({
      name,
      email,
      password,
      role: role || "editor",
    });

    await newUser.save();

    res.status(201).json({
      message: "管理者ユーザーが正常に作成されました",
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Create admin user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const getAdminCount = async (req, res) => {
  try {
    const adminCount = await AdminUser.countDocuments();
    res.json({ adminCount });
  } catch (error) {
    console.error("[AuthController] Get admin count error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

export {
  login,
  getCurrentUser,
  createAdminUser,
  initializeAdminUser,
  getAdminCount,
};
