import { useState } from "react";
import { Outlet } from "react-router-dom";

/**
 * legacyルート用のラッパーコンポーネント
 * AppLayoutが期待するOutletContextを提供する
 */
function LegacyWrapper() {
  const [userId, setUserId] = useState<string | null>(null);
  
  return (
    <Outlet context={{ userId, setUserId }} />
  );
}

export default LegacyWrapper;
