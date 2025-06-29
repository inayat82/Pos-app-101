'use client';

import React from 'react';
import AdvancedSettings from '@/components/superadmin/AdvancedSettings';

export default function AdvancedSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Advanced Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure system-wide settings for Firebase, APIs, security, and application behavior.
        </p>
      </div>
      
      <AdvancedSettings />
    </div>
  );
}
