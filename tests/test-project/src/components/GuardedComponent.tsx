import React from 'react';

const ErrorState = () => <div className="error">Error</div>;
const Spinner = () => <div className="spinner">Loading</div>;

export const GuardedComponent = ({ loading, error }: { loading: boolean, error: boolean }) => {
  if (error) return <ErrorState />;
  if (loading) return <Spinner />;
  
  return (
    <div className="layout bg-white p-6 shadow rounded">
      <h1 className="text-xl font-bold">Main Content</h1>
      <p>This is the content that should be refactored.</p>
    </div>
  );
};
