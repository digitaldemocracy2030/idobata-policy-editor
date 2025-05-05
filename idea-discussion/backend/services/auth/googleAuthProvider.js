import { OAuth2Client } from "google-auth-library";
import User from "../../models/User.js";
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
      const displayName = payload.name;
      const profileImageUrl = payload.picture;

      let user = await User.findOne({ googleId });

      if (!user) {
        user = await User.findOne({ email });

        if (user) {
          user.googleId = googleId;
          user.email = email;
          user.displayName = displayName || user.displayName;
          user.profileImageUrl = profileImageUrl || user.profileImageUrl;
          await user.save();
        } else {
          user = new User({
            googleId,
            email,
            displayName,
            profileImageUrl,
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
