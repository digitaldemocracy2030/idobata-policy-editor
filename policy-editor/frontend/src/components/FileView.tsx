// src/components/FileView.tsx
import React from 'react';
import { decodeBase64Content } from '../lib/github'; // Base64デコード関数をインポート
import MarkdownViewer from './MarkdownViewer'; // Import the actual component

// Define the expected structure for the file data prop
// Should align with the GitHubFile interface from lib/github.ts
// Use the exported type from lib/github.ts for consistency
import type { GitHubFile } from '../lib/github';

interface FileData extends Pick<GitHubFile, 'name' | 'path' | 'content' | 'encoding' | 'size' > {
    // Add other specific properties needed by FileView if any,
    // or just use GitHubFile directly if all properties might be needed.
    // Using Pick here to only include necessary fields for this component.
    download_url?: string | null; // Make download_url optional if using Pick
}


interface FileViewProps {
  data: FileData; // Expecting a single file data object
}

const FileView: React.FC<FileViewProps> = ({ data }) => {
  // Check if the file is a Markdown file (case-insensitive)
  const isMarkdown = /\.(md|mdx)$/i.test(data.name);

  if (isMarkdown) {
    // Decode the Base64 content
    const decodedContent = decodeBase64Content(data.content);
    return <MarkdownViewer content={decodedContent} />;
  } else {
    // Display message for non-markdown files
    return (
      <div className="p-4 border rounded bg-gray-50 text-center">
        <p className="font-semibold text-gray-700">ファイル：{data.name}</p>
        <p className="mt-2 text-sm text-gray-500">
          このファイルタイプのプレビューはサポートされていません。
        </p>
        {/* Optionally, add a download link if available */}
        {/* {data.download_url && (
          <a
            href={data.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            ファイルをダウンロード
          </a>
        )} */}
      </div>
    );
  }
};

export default FileView;