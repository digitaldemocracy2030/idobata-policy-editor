import AdminUser from "../../models/AdminUser.js";

class LocalAuthProvider {
  async authenticate({ email, password }) {
    if (!email || !password) {
      throw new Error("メールアドレスとパスワードを入力してください");
    }

    const user = await AdminUser.findOne({ email });

    if (!user) {
      throw new Error("ユーザーが見つかりません");
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      throw new Error("パスワードが正しくありません");
    }

    return user;
  }
}

export default LocalAuthProvider;
