import React, { useState } from 'react';
import { useTranslation } from '@/atomic-pure-hooks/useTranslation';
import { useTheme } from '@/atomic-pure-hooks/useTheme';
import { useFetchMetrics } from '@/api/useFetchMetrics';

export const DashboardWidget = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { data, loading } = useFetchMetrics();
  const [expanded, setExpanded] = useState(false);

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>;

  return (
    <div className={`p-4 rounded border ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">{t('dashboard.title')}</h3>
        <button onClick={() => setExpanded(!expanded)} className="text-blue-500">
          {expanded ? t('action.collapse') : t('action.expand')}
        </button>
      </div>
      
      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="p-2 bg-blue-50 rounded">
            <span className="text-sm">{t('metrics.users')}</span>
            <strong className="block text-2xl">{data?.usersCount}</strong>
          </div>
          {/* ... other metrics ... */}
        </div>
      )}
    </div>
  );
};