'use client';

import React from 'react';
import SystemHealthMonitor from '@/components/superadmin/SystemHealthMonitor';

export default function SystemHealthPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">System Health <span className="text-lg font-normal text-amber-600">(Mock Data)</span></h1>
        <p className="text-gray-600 mt-2">
          Monitor the health and performance of all system components and services.
        </p>
      </div>
      
      <SystemHealthMonitor />
    </div>
  );
}
