import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/layout/Header";
import MainContent from "./components/layout/MainContent";
import Sidebar from "./components/layout/Sidebar";
import { AuthProvider } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import ThemeCreate from "./pages/ThemeCreate";
import ThemeEdit from "./pages/ThemeEdit";
import ThemeList from "./pages/ThemeList";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="flex flex-col h-screen">
                  <Header />
                  <div className="flex flex-1 overflow-hidden">
                    <Sidebar />
                    <MainContent>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/themes" element={<ThemeList />} />
                        <Route path="/themes/new" element={<ThemeCreate />} />
                        <Route
                          path="/themes/:themeId"
                          element={<ThemeEdit />}
                        />
                      </Routes>
                    </MainContent>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
