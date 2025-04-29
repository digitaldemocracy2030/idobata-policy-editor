import React from "react";
import ThemeForm from "../components/theme/ThemeForm";

const ThemeCreate: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">新規テーマ作成</h1>
      <ThemeForm />
    </div>
  );
};

export default ThemeCreate;
