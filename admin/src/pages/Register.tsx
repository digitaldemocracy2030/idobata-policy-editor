import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api/apiClient";

const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminCount = async () => {
      try {
        const result = await apiClient.getAdminCount();
        if (result.isOk()) {
          setAdminExists(result.value.adminCount > 0);
        } else {
          setError("管理者ユーザー数の取得中にエラーが発生しました");
        }
      } catch (err) {
        console.error("Admin count check error:", err);
        setError("管理者ユーザー数の取得中にエラーが発生しました");
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminCount();
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  if (adminExists) {
    return <Navigate to="/login" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      setError("名前を入力してください");
      return;
    }

    if (!email) {
      setError("メールアドレスを入力してください");
      return;
    }

    if (!password) {
      setError("パスワードを入力してください");
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードと確認用パスワードが一致しません");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const result = await apiClient.initializeAdmin({
        name,
        email,
        password,
      });

      if (result.isOk()) {
        const loginSuccess = await login(email, password);
        if (loginSuccess) {
          navigate("/");
        } else {
          navigate("/login");
        }
      } else {
        setError(`管理者ユーザーの作成に失敗しました: ${result.error.message}`);
      }
    } catch (err) {
      setError("管理者ユーザーの作成中にエラーが発生しました");
      console.error("Register error:", err);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            初期管理者ユーザー登録
          </h1>
          <p className="mt-2 text-gray-600">
            いどばたの管理画面を使用するための初期管理者ユーザーを作成してください
          </p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <Input
            label="名前"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="管理者名"
          />

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

          <Input
            label="パスワード（確認用）"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "登録中..." : "登録する"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Register;
