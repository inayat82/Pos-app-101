'use client';

import React from 'react';
import NotificationCenter from '@/components/superadmin/NotificationCenter';

export default function NotificationsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Notifications</h1>
        <p className="text-gray-600 mt-2">
          Manage system notifications, alerts, and important updates.
        </p>
      </div>
      
      <NotificationCenter />
    </div>
  );
}
