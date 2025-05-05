import { Menu, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useMock } from "../../contexts/MockContext";
import { useSiteConfig } from "../../contexts/SiteConfigContext";
import { useThemes } from "../../hooks/useThemes";
import { SheetTrigger } from "../ui/base/sheet";
import { Button } from "../ui/button";
import {
  NavigationRouterLink,
  NavigationSheet,
  NavigationSheetContent,
} from "../ui/navigation/menu-sheet";

const Header = () => {
  const { themes, isLoading, error } = useThemes();
  const { siteConfig, loading } = useSiteConfig();
  const { user } = useAuth();
  const { isMockMode } = useMock();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMockMode = () => {
    const currentParams = new URLSearchParams(location.search);
    let targetPathname = location.pathname;
    let targetSearch = "";

    if (isMockMode) {
      targetPathname = "/";
      currentParams.delete("mock");
      targetSearch = currentParams.toString();
    } else {
      currentParams.set("mock", "true");
      targetSearch = currentParams.toString();
    }

    navigate(
      {
        pathname: targetPathname,
        search: targetSearch,
      },
      { replace: true }
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-10 bg-white border-b-2 border-primary-700 py-3 px-4">
      <div className="flex justify-between items-center">
        {/* ハンバーガーメニュー（左） */}
        <NavigationSheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <NavigationSheetContent className="w-72">
            <nav className="flex flex-col gap-4 mt-8">
              <NavigationRouterLink
                to="/"
                className="text-lg py-2 px-4 hover:bg-primary-50 rounded-md"
              >
                TOP
              </NavigationRouterLink>
              <NavigationRouterLink
                to="/about"
                className="text-lg py-2 px-4 hover:bg-primary-50 rounded-md"
              >
                このサイトについて
              </NavigationRouterLink>
              <NavigationRouterLink
                to="/mypage"
                className="text-lg py-2 px-4 hover:bg-primary-50 rounded-md"
              >
                マイページ
              </NavigationRouterLink>

              {isLoading && (
                <div className="px-4 py-2 text-sm text-gray-500">
                  読み込み中...
                </div>
              )}

              {error && (
                <div className="px-4 py-2 text-sm text-red-500">{error}</div>
              )}

              {!isLoading && !error && themes.length === 0 && (
                <div className="px-4 py-2 text-sm text-gray-500">
                  テーマがありません
                </div>
              )}

              {themes.length > 0 && !isLoading && !error && (
                <div className="py-2">
                  <h3 className="text-lg text-gray-500 px-4">テーマ一覧</h3>

                  <div className="flex flex-col mt-2">
                    {themes.map((theme) => (
                      <NavigationRouterLink
                        key={theme._id}
                        to={`/themes/${theme._id}`}
                        className="text-base py-2 hover:bg-primary-50 rounded-md ml-8"
                      >
                        {theme.title}
                      </NavigationRouterLink>
                    ))}
                  </div>
                </div>
              )}

              {process.env.NODE_ENV === "development" && (
                <div className="flex mt-4 px-4">
                  <Button
                    variant="outline"
                    onClick={toggleMockMode}
                    className="text-xs"
                  >
                    {isMockMode
                      ? "モックモードを解除しトップへ"
                      : "モックモードに入る（開発用）"}
                  </Button>
                </div>
              )}
            </nav>
          </NavigationSheetContent>
        </NavigationSheet>

        {/* サイトタイトル（中央） */}
        <Link to="/top">
          <h1 className="text-base font-semibold text-center">
            {loading
              ? "..."
              : siteConfig?.title || "XX党 みんなの政策フォーラム"}
          </h1>
        </Link>

        {/* マイページアイコン（右） */}
        <Link to="/mypage">
          <Button variant="ghost" size="icon" className="relative">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt="プロフィール画像"
                className="rounded-full w-6 h-6 object-cover"
              />
            ) : (
              <div className="rounded-full border-2 border-black flex items-center justify-center w-6 h-6">
                <User className="h-6 w-6" />
              </div>
            )}
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default Header;
