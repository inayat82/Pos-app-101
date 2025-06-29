'use client';

import React from 'react';
import ActivityLogsViewer from '@/components/superadmin/ActivityLogsViewer';

export default function ActivityLogsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Activity Logs</h1>
        <p className="text-gray-600 mt-2">
          Monitor all user activities and system events across the application.
        </p>
      </div>
      
      <ActivityLogsViewer />
    </div>
  );
}
