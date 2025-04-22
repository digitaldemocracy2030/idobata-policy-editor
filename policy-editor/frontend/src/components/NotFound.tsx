import React from 'react';
import { Link } from 'react-router-dom';

// Placeholder for 404 page
const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <h1 className="text-4xl font-bold mb-4">404 - ページが見つかりません</h1>
      <p className="text-lg text-gray-600 mb-8">
        お探しのページは存在しません。
      </p>
      <Link
        to="/"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        ホームに戻る
      </Link>
    </div>
  );
};

export default NotFound;