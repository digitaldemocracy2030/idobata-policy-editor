import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api/apiClient";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminCount = async () => {
      try {
        const result = await apiClient.getAdminCount();
        if (result.isOk()) {
          setAdminExists(result.value.adminCount > 0);
        }
      } catch (err) {
        console.error("Admin count check error:", err);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminCount();
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  if (!isCheckingAdmin && !adminExists) {
    return <Navigate to="/register" />;
  }

  if (isCheckingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("メールアドレスを入力してください");
      return;
    }

    if (!password) {
      setError("パスワードを入力してください");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate("/");
      } else {
        setError("メールアドレスまたはパスワードが正しくありません");
      }
    } catch (err) {
      setError("ログイン処理中にエラーが発生しました。");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">管理画面ログイン</h1>
          <p className="mt-2 text-gray-600">
            アカウント情報を入力してログインしてください
          </p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <Input
            label="メールアドレス"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
          />

          <Input
            label="パスワード"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
