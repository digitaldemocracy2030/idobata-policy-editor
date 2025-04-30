import { useEffect, useState } from "react";
import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./ThemeContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import AppLayout from "./components/AppLayout";
import PageLayout from "./components/layout/PageLayout";
import About from "./pages/About";
import DataPage from "./pages/DataPage";
import MainPage from "./pages/MainPage";
import QuestionDetail from "./pages/QuestionDetail";
import ThemeDetail from "./pages/ThemeDetail";
import Themes from "./pages/Themes";
import Top from "./pages/Top";

function App() {
  const [userId, setUserId] = useState<string | null>(
    localStorage.getItem("policyChatUserId") || null
  );

  useEffect(() => {
    if (userId) {
      localStorage.setItem("policyChatUserId", userId);
    } else {
      // Optional: Clear localStorage if userId becomes null (e.g., on logout)
      // localStorage.removeItem('policyChatUserId');
    }
  }, [userId]);

  return <Outlet context={{ userId, setUserId }} />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ThemeProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </ThemeProvider>
    ),
    children: [
      { index: true, element: <Navigate to="/top" replace /> },
      {
        path: "legacy",
        element: <AppLayout />,
        children: [
          { index: true, element: <MainPage /> },
          { path: "data", element: <DataPage /> },
          { path: "*", element: <Navigate to="/old" replace /> },
        ],
      },
      {
        path: "top",
        element: (
          <PageLayout>
            <Top />
          </PageLayout>
        ),
      },
      {
        path: "about",
        element: (
          <PageLayout>
            <About />
          </PageLayout>
        ),
      },
      {
        path: "themes",
        element: (
          <PageLayout>
            <Themes />
          </PageLayout>
        ),
      },
      {
        path: "themes/:themeId",
        element: (
          <PageLayout>
            <ThemeDetail />
          </PageLayout>
        ),
      },
      {
        path: "themes/:themeId/questions/:qId",
        element: (
          <PageLayout>
            <QuestionDetail />
          </PageLayout>
        ),
      },
    ],
  },
]);

export default App;
