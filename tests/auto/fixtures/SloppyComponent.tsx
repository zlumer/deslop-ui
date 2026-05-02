import React, { useState } from 'react';

interface User {
  id: number;
  name: string;
  avatar: string;
  role: string;
}

export const SloppyDashboard: React.FC<{ users: User[]; onLogout: () => void }> = ({ users, onLogout }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-[47px] bg-[#f0f0f0] min-h-screen font-['Arial']">
      {/* Header section */}
      <div className="flex justify-between items-center mb-8 border-b-2 border-[#ccc] pb-[18px]">
        <h1 className="text-[28px] text-[#1a1a2e] font-bold tracking-tight">Team Dashboard</h1>
        <button
          onClick={onLogout}
          className="px-[22px] py-2 bg-[#e74c3c] text-white border-none rounded-md cursor-pointer text-[13px]"
        >
          Logout
        </button>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search team members..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 text-[15px] border border-[#ddd] rounded-lg outline-none"
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-8">
        <div className="flex-1 bg-[#3498db] text-white rounded-xl p-5 text-center">
          <div className="text-4xl font-extrabold">{users.length}</div>
          <div className="text-[13px] opacity-[0.85]">Total Members</div>
        </div>
        <div className="flex-1 bg-[#2ecc71] text-white rounded-xl p-5 text-center">
          <div className="text-4xl font-extrabold">{filtered.length}</div>
          <div className="text-[13px] opacity-[0.85]">Matching</div>
        </div>
      </div>

      {/* User list */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {filtered.map(user => (
          <div
            key={user.id}
            onClick={() => setSelectedId(user.id)}
            className={`p-5 rounded-xl cursor-pointer transition-all duration-200 ${
              selectedId === user.id
                ? 'bg-[#eaf2ff] border-2 border-[#3498db]'
                : 'bg-white border border-[#e0e0e0]'
            }`}
          >
            <div className="flex items-center gap-[14px]">
              <img src={user.avatar} alt={user.name} className="w-[52px] h-[52px] rounded-full object-cover" />
              <div>
                <div className="text-[17px] font-semibold text-[#1a1a2e]">{user.name}</div>
                <div className="text-[13px] text-[#888] mt-0.5">{user.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-10 text-center text-[#aaa] text-xs">
        &copy; 2025 Team Dashboard. All rights reserved.
      </div>
    </div>
  );
};
