'use client';

import ApiMonitorClient from '@/components/superadmin/ApiMonitorClient';
import { FC } from 'react';

interface PageProps {}

const Page: FC<PageProps> = ({}) => {
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Centralized API Monitoring</h1>
        <p className="text-gray-600">
          Monitor all API calls, sync jobs, and cron operations across all admin accounts from this unified dashboard
        </p>
      </div>

      {/* Unified API Monitor Component */}
      <ApiMonitorClient />
    </div>
  );
};

export default Page;
