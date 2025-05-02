import React from "react";
import MainPage from "../pages/MainPage";
import AppLayout from "./AppLayout";

/**
 * legacyルート用のMainPageラッパー
 * AppLayoutとMainPageを組み合わせたコンポーネント
 */
function LegacyMainPage() {
  return (
    <AppLayout>
      <MainPage />
    </AppLayout>
  );
}

export default LegacyMainPage;
