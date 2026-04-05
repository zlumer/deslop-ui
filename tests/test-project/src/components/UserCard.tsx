import React from 'react';

export interface UserCardProps {
  avatarUrl: string;
  name: string;
  role: string;
  onProfileClick: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({ avatarUrl, name, role, onProfileClick }) => {
  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-xl shadow-md">
      <img className="w-24 h-24 rounded-full mb-4" src={avatarUrl} alt="Avatar" />
      <h2 className="text-xl font-bold text-gray-800">{name}</h2>
      <p className="text-sm text-gray-500 mb-6">{role}</p>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={onProfileClick}
      >
        View Profile
      </button>
    </div>
  );
};