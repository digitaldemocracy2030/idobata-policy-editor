import React from "react";
import { useEffect, useState } from "react";
import type { FC } from "react";
import { Link } from "react-router-dom";
import ThemeTable from "../components/theme/ThemeTable";
import Button from "../components/ui/Button";
import { apiClient } from "../services/api/apiClient";
import type { Theme } from "../services/api/types";

const ThemeList: FC = () => {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThemes = async () => {
    setLoading(true);

    const result = await apiClient.getAllThemes();

    result.match(
      (data) => {
        setThemes(data);
        setError(null);
      },
      (error) => {
        console.error("Failed to fetch themes:", error);
        setError("テーマの取得に失敗しました。");
      }
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) {
      return;
    }

    const result = await apiClient.deleteTheme(id);

    result.match(
      () => {
        fetchThemes();
      },
      (error) => {
        console.error("Failed to delete theme:", error);
        alert("テーマの削除に失敗しました。");
      }
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">テーマ一覧</h1>
        <Link to="/themes/new">
          <Button>新規テーマ作成</Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-4">読み込み中...</div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>
      ) : (
        <ThemeTable themes={themes} onDelete={handleDelete} />
      )}
    </div>
  );
};

export default ThemeList;
