import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import ContentExplorer from './components/ContentExplorer';
import NotFound from './components/NotFound'; // 404 page component

// Wrapper component to extract path from URL splat and pass it to ContentExplorer
function ContentExplorerWrapper() {
    const params = useParams();
    // Get the path after /view/. If no path, default to empty string (root)
    const path = params['*'] || '';
    // Use key={path} to force re-render/remount of ContentExplorer when the path changes
    return <ContentExplorer key={path} initialPath={path} />;
}

function App() {
  // In later steps, we might initialize Zustand store here with env variables
  // const repoOwner = import.meta.env.VITE_GITHUB_REPO_OWNER;
  // const repoName = import.meta.env.VITE_GITHUB_REPO_NAME;
  // console.log(`Repo: ${repoOwner}/${repoName}`);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Route for the repository root */}
          <Route index element={<ContentExplorer initialPath="" />} />
          {/* Route for paths within the repository */}
          <Route path="view/*" element={<ContentExplorerWrapper />} />
          {/* Catch-all route for any other paths (404) */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
