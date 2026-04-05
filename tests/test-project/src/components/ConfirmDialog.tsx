import React from 'react';

interface Props {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({ title, onConfirm, onCancel }) => {
  return (
    <div className="p-8 bg-white rounded shadow-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="flex justify-end gap-2 mt-4">
        <button 
          className="px-4 py-2 font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button 
          className="px-4 py-2 font-medium rounded text-white bg-red-600 hover:bg-red-700"
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </div>
  );
};