import { OAuth2Client } from "google-auth-library";
import AdminUser from "../../models/AdminUser.js";
import AuthProviderInterface from "./authProviderInterface.js";

export default class GoogleAuthProvider extends AuthProviderInterface {
  constructor() {
    super();
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async authenticate({ code }) {
    try {
      const { tokens } = await this.client.getToken(code);
      
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      
      const payload = ticket.getPayload();
      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name;
      
      let user = await AdminUser.findOne({ googleId });
      
      if (!user) {
        user = await AdminUser.findOne({ email });
        
        if (user) {
          user.googleId = googleId;
          await user.save();
        } else {
          const isFirstUser = await AdminUser.countDocuments() === 0;
          
          user = new AdminUser({
            name,
            email,
            password: Math.random().toString(36).slice(-10),
            role: isFirstUser ? "admin" : "editor",
            googleId,
          });
          
          await user.save();
        }
      }
      
      return user;
    } catch (error) {
      console.error("Google authentication error:", error);
      throw new Error("Google認証に失敗しました");
    }
  }

  getAuthUrl() {
    return this.client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      prompt: "consent",
    });
  }
}
