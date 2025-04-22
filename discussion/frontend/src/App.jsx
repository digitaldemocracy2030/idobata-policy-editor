import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './pages/MainPage';
import DataPage from './pages/DataPage';
import AppLayout from './components/AppLayout';
import './App.css';

function App() {
  const [userId, setUserId] = useState(localStorage.getItem('policyChatUserId') || null);

  useEffect(() => {
    if (userId) {
      localStorage.setItem('policyChatUserId', userId);
    } else {
      // Optional: Clear localStorage if userId becomes null (e.g., on logout)
      // localStorage.removeItem('policyChatUserId');
    }
  }, [userId]);

  return (
    <Routes>
      <Route element={<AppLayout userId={userId} setUserId={setUserId} />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
