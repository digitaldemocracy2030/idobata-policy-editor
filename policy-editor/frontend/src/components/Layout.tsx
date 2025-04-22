import React from 'react';
import { Outlet } from 'react-router-dom';
import ChatPanel from './ChatPanel'; // Assuming ChatPanel is in the same directory

const Layout: React.FC = () => {
  return (
    <div className="flex h-screen">
      {/* Left Pane (Chat Panel) */}
      <div className="w-1/3 border-r border-gray-300 overflow-y-auto sticky top-0 h-screen">
        <ChatPanel />
      </div>

      {/* Right Pane (Content Area) */}
      <div className="w-2/3 overflow-y-auto p-4">
        <Outlet /> {/* Nested routes will render here */}
      </div>
    </div>
  );
};

export default Layout;