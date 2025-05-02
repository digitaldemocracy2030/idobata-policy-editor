import React from "react";
import AppLayout from "./AppLayout";
import MainPage from "../pages/MainPage";

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
