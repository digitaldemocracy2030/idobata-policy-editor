// src/components/ContentExplorerWrapper.tsx
import { useParams } from 'react-router-dom';
import ContentExplorer from './ContentExplorer';

/**
 * URLのパスパラメータ (*) を抽出し、ContentExplorerに渡すラッパーコンポーネント。
 * パスが変わるたびにContentExplorerを再マウントさせるために key を使用します。
 */
function ContentExplorerWrapper() {
    const params = useParams();
    const path = params['*'] || ''; // /view/ 以降のパスを取得、なければ空文字 (ルート)

    console.log('ContentExplorerWrapper rendering with path:', path); // デバッグ用

    // path を key に設定することで、URLが変わるたびに ContentExplorer が再マウントされ、
    // useEffect 内のデータ取得処理が再度実行されるようになります。
    return <ContentExplorer key={path} initialPath={path} />;
}

export default ContentExplorerWrapper;