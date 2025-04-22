// src/components/Breadcrumbs.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import useContentStore from '../store/contentStore';
import { FaHome } from 'react-icons/fa'; // Home icon

const Breadcrumbs: React.FC = () => {
  // Select individual state slices
  const currentPath = useContentStore((state) => state.currentPath);
  const repoOwner = useContentStore((state) => state.repoOwner);
  const repoName = useContentStore((state) => state.repoName);

  // パスを '/' で分割し、空の要素を除去
  const pathSegments = currentPath.split('/').filter(Boolean);

  // パンくずリストの要素を生成
  const breadcrumbItems = pathSegments.map((segment, index) => {
    // 現在のセグメントまでのパスを再構築
    const pathToSegment = pathSegments.slice(0, index + 1).join('/');
    const isLast = index === pathSegments.length - 1;

    return (
      <React.Fragment key={pathToSegment}>
        <span className="mx-1 text-gray-400">/</span>
        {isLast ? (
          // 最後の要素はリンクではなくテキスト
          <span className="font-medium text-gray-700">{segment}</span>
        ) : (
          // 途中の要素はリンク
          <Link
            to={`/view/${pathToSegment}`}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {segment}
          </Link>
        )}
      </React.Fragment>
    );
  });

  return (
    <nav aria-label="Breadcrumb" className="p-2 mb-4 bg-gray-100 rounded text-sm">
      <ol className="flex items-center space-x-1 text-gray-600">
        <li>
          {/* ルートへのリンク */}
          <Link
            to="/view/" // ルートパスを指定
            className="flex items-center text-blue-600 hover:text-blue-800 hover:underline"
            title={`${repoOwner}/${repoName} ルート`}
          >
            <FaHome className="mr-1 h-4 w-4" />
            <span className="font-medium">{repoName}</span>
          </Link>
        </li>
        {/* 各階層へのリンク */}
        {breadcrumbItems}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;