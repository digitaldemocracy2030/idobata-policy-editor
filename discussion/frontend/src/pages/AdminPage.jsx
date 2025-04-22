import React from 'react';
import AdminPanel from '../components/AdminPanel';

function AdminPage() {
  return (
    <div className="container mx-auto h-full">
      <h1 className="text-lg font-semibold text-primary mb-4">
        Idobata 管理パネル
      </h1>
      <AdminPanel />
    </div>
  );
}

export default AdminPage;