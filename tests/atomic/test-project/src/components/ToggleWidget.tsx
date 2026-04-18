import React, { useState } from 'react';

export const ToggleWidget = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 border rounded">
      <h2>Widget</h2>
      <button onClick={() => setExpanded(!expanded)} className="px-2 py-1 bg-blue-500 text-white rounded">
        {expanded ? 'Collapse' : 'Expand'}
      </button>
      {expanded && <div className="mt-2">Content here</div>}
    </div>
  );
};
