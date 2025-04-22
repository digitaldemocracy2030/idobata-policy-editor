// src/components/ErrorDisplay.tsx
import React from 'react';

interface ErrorDisplayProps {
  error: Error | null; // Accept Error object or null
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  if (!error) {
    return null; // Don't render anything if there's no error
  }

  // Try to extract specific messages for common errors
  let displayMessage = error.message;
  if (error.message.includes('404')) {
    displayMessage = 'コンテンツが見つかりません (404)。パスを確認してください。';
  } else if (error.message.includes('Rate limit exceeded')) {
    displayMessage = 'GitHub APIのレート制限を超えました。しばらく待ってから再試行するか、パーソナルアクセストークンを設定してください。';
  } else if (error.message.includes('403')) {
     displayMessage = 'アクセスが禁止されています (403)。権限またはレート制限が原因である可能性があります。';
  }

  return (
    <div
      className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-100 border border-red-300"
      role="alert"
    >
      <span className="font-medium">エラー：</span> {displayMessage}
      {/* Optionally show the full error message for debugging */}
      {/* <pre className="mt-2 text-xs font-mono bg-red-50 p-2 rounded overflow-auto">{error.stack || error.message}</pre> */}
    </div>
  );
};

export default ErrorDisplay;