import { useRef } from "react";
import {
  FloatingChat,
  type FloatingChatRef,
} from "../components/chat/FloatingChat";
import BreadcrumbView from "../components/common/BreadcrumbView";
import ThemeCard from "../components/home/ThemeCard";
import { useThemes } from "../hooks/useThemes";

const Themes = () => {
  const breadcrumbItems = [
    { label: "TOP", href: "/" },
    { label: "テーマ一覧", href: "/themes" },
  ];

  const chatRef = useRef<FloatingChatRef>(null);
  const { themes, loading, error } = useThemes();

  const handleSendMessage = (message: string) => {
    console.log("Message sent:", message);

    setTimeout(() => {
      chatRef.current?.addMessage("メッセージを受け取りました。", "system");
    }, 500);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbView items={breadcrumbItems} />

      <h1 className="text-2xl md:text-3xl font-bold mb-4">議論テーマ一覧</h1>

      <p className="text-sm text-neutral-600 mb-8">
        全国から寄せられた多様な意見をもとに、重要な社会課題について議論するテーマを設定しています。
        関心のあるテーマに参加して、あなたの声を政策づくりに活かしましょう。
      </p>

      {loading && (
        <div className="text-center py-8">
          <p>テーマを読み込み中...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-8">
          <p>エラーが発生しました: {error.message}</p>
        </div>
      )}

      {!loading && !error && themes.length === 0 && (
        <div className="text-center py-8">
          <p>テーマがありません。</p>
        </div>
      )}

      {!loading && !error && themes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-12">
          {themes.map((theme) => (
            <ThemeCard
              key={theme._id}
              id={theme._id}
              title={theme.title}
              description={theme.description}
              keyQuestionCount={theme.keyQuestionCount}
              commentCount={theme.commentCount}
            />
          ))}
        </div>
      )}

      <FloatingChat ref={chatRef} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default Themes;
