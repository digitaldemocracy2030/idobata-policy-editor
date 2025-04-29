import AdminUser from "../../models/AdminUser.js";
import AuthProviderInterface from "./authProviderInterface.js";

export default class LocalAuthProvider extends AuthProviderInterface {
  async authenticate({ email, password }) {
    const user = await AdminUser.findOne({ email }).select("+password");

    if (!user) {
      throw new Error("ユーザーが見つかりません");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error("パスワードが正しくありません");
    }

    return user;
  }
}
