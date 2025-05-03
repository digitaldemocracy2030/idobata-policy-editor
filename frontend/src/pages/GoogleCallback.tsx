import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/UnifiedAuthContext";

const GoogleCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { loading } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const token = params.get("token");
        const errorMsg = params.get("error");

        if (errorMsg) {
          setError(errorMsg);
          return;
        }

        if (token) {
          localStorage.setItem("auth_token", token);

          navigate("/");
        } else {
          setError("認証トークンが見つかりません");
        }
      } catch (err) {
        console.error("Google callback error:", err);
        setError("認証処理中にエラーが発生しました");
      }
    };

    if (!loading) {
      handleCallback();
    }
  }, [loading, location, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
        <p className="text-lg text-gray-700">認証処理中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">エラー</p>
          <p>{error}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          ホームに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
      <p className="text-lg text-gray-700">リダイレクト中...</p>
    </div>
  );
};

export default GoogleCallback;
