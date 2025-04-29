import React from "react";
import type { FC } from "react";

const Dashboard: FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">
          ようこそ、いどばた管理画面へ。左側のナビゲーションから各機能にアクセスできます。
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
