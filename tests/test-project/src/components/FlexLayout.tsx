import React from 'react';

export const FlexLayout = () => {
  return (
    <div className="flex gap-4 p-4 border bg-gray-50">
      <div className="bg-white p-4 rounded shadow flex-1">Item 1</div>
      <div className="bg-white p-4 rounded shadow flex-1">Item 2</div>
    </div>
  );
};
