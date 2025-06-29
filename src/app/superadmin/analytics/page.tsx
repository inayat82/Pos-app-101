'use client';

import React from 'react';
import SuperAdminAnalytics from '@/components/superadmin/SuperAdminAnalytics';

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive analytics and insights across the entire platform.
        </p>
      </div>
      
      <SuperAdminAnalytics />
    </div>
  );
}
