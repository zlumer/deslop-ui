import React, { useRef, useEffect } from 'react';

export const SearchInput = () => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      <svg className="absolute left-2 top-2 w-4 h-4 text-gray-500" />
      <input 
        ref={searchInputRef} 
        type="text" 
        className="pl-8 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500" 
        placeholder="Search..." 
      />
    </div>
  );
};
