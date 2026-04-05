import React from 'react';

export const DashboardPage = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      <nav className="w-64 bg-gray-800 text-white">
        <ul>
          <li>Dashboard</li>
          <li>Settings</li>
        </ul>
      </nav>
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white shadow-sm flex items-center px-4">
          <input type="text" placeholder="Search..." className="border rounded px-2" />
        </header>
        <main className="p-6 flex-1 overflow-auto">
          <h1>Main Content</h1>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow">Card 1</div>
            <div className="bg-white p-4 rounded shadow">Card 2</div>
          </div>
        </main>
      </div>
    </div>
  );
};
