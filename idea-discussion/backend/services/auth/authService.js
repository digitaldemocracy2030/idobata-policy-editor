import jwt from "jsonwebtoken";
import LocalAuthProvider from "./localAuthProvider.js";

class AuthService {
  constructor() {
    this.providers = {
      local: new LocalAuthProvider(),
    };
  }

  getProvider(providerName) {
    const provider = this.providers[providerName];
    if (!provider) {
      throw new Error(`認証プロバイダー '${providerName}' が見つかりません`);
    }
    return provider;
  }

  async authenticate(providerName, credentials) {
    const provider = this.getProvider(providerName);
    const user = await provider.authenticate(credentials);

    user.lastLogin = new Date();
    await user.save();

    const token = this.generateToken(user);

    return {
      user,
      token,
    };
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error("無効なトークンです");
    }
  }
}

export default new AuthService();
