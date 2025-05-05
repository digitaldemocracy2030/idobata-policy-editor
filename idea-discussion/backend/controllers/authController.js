import AdminUser from "../models/AdminUser.js";
import User from "../models/User.js";
import authService from "../services/auth/authService.js";

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

const initializeAdminUser = async (req, res) => {
  try {
    const adminCount = await AdminUser.countDocuments();

    if (adminCount > 0) {
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

    const newUser = new AdminUser({
      name,
      email,
      password,
      role: "admin", // 初期ユーザーは常に管理者権限
    });

    await newUser.save();

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

const getGoogleAuthUrl = async (req, res) => {
  try {
    const googleProvider = authService.getProvider("google");
    const authUrl = googleProvider.getAuthUrl();

    res.json({ url: authUrl });
  } catch (error) {
    console.error("[AuthController] Get Google auth URL error:", error);
    res.status(500).json({ message: "Google認証URLの取得に失敗しました" });
  }
};

const googleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: "認証コードが見つかりません" });
  }

  try {
    const { user, token } = await authService.authenticate("google", { code });

    const redirectUrl = new URL(process.env.FRONTEND_URL);
    redirectUrl.pathname = "/auth/google/callback";
    redirectUrl.searchParams.append("token", token);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("[AuthController] Google callback error:", error);

    const redirectUrl = new URL(process.env.FRONTEND_URL);
    redirectUrl.pathname = "/auth/google/callback";
    redirectUrl.searchParams.append("error", "認証に失敗しました");

    res.redirect(redirectUrl.toString());
  }
};

const getUserInfo = async (req, res) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user.id);
      
      if (user) {
        return res.json({
          user: {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            profileImageUrl: user.profileImageUrl,
          },
        });
      }
    }
    
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ message: "ユーザーIDが必要です" });
    }
    
    let user = await User.findOne({ userId });
    
    if (!user) {
      user = new User({ userId });
      await user.save();
    }
    
    res.json({
      id: user._id,
      userId: user.userId,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
    });
  } catch (error) {
    console.error("[AuthController] Get user info error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const logout = async (req, res) => {
  try {
    res.json({ message: "ログアウトしました" });
  } catch (error) {
    console.error("[AuthController] Logout error:", error);
    res.status(500).json({ message: "ログアウト処理中にエラーが発生しました" });
  }
};

export { 
  login, 
  getCurrentUser, 
  createAdminUser, 
  initializeAdminUser,
  
  getGoogleAuthUrl,
  googleCallback,
  getUserInfo,
  logout
};
