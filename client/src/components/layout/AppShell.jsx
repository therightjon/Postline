import React from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }) {
  return (
    <div className="app-layout" data-sidebar-layout>
      <Sidebar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
