'use client';

import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/user';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React from 'react';

// Placeholder icons - replace with actual icons from a library like heroicons
const UserGroupIcon = () => <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.28-.24-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.28.24-1.857m10.514-2.87A4 4 0 0016 12c0-2.21-1.79-4-4-4s-4 1.79-4 4c0 .712.187 1.374.514 1.973M12 12a2 2 0 100-4 2 2 0 000 4z" /></svg>;
const CogIcon = () => <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const ShieldCheckIcon = () => <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.588-3.75M9 12l2 2 4-4" /></svg>;

export default function SuperAdminDashboardPage() {
  const { currentUser, userProfile, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
        <p className="text-xl text-gray-700">Loading dashboard...</p>
      </div>
    );
  }

  // If not loading and no user, or user is not a SuperAdmin, redirect
  if (!currentUser || !userProfile) {
    router.replace('/login');
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
            <p className="text-xl text-gray-700">Redirecting...</p>
        </div>
    );
  }
  if (userProfile.role?.toLowerCase() !== UserRole.SuperAdmin.toLowerCase()) {
    router.replace('/'); // Or an unauthorized page
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
            <p className="text-xl text-gray-700">Unauthorized. Redirecting...</p>
        </div>
    );
  }

  // User is a SuperAdmin
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Super Admin Dashboard</h1>

      <p className="text-gray-600 mb-10 text-md">
        Welcome to the Super Admin control panel. From here, you can manage critical application settings and oversee user activities.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Card 1: User Management */}
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center mb-4">
            <UserGroupIcon />
            <h2 className="ml-3 text-xl font-semibold text-gray-700">User Management</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            View and manage admin users and their associated Takealot integrations. Oversee all user accounts and roles within the application.
          </p>
          <button 
            onClick={() => window.location.href='/superadmin/user-management'} 
            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            Go to User Management &rarr;
          </button>
        </div>

        {/* Card 2: System Configurations */}
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center mb-4">
            <CogIcon />
            <h2 className="ml-3 text-xl font-semibold text-gray-700">System Configurations</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Configure Firebase, authentication providers, proxy services, and other critical API integrations. Manage global application settings.
          </p>
          <button 
            onClick={() => window.location.href='/superadmin/firebase-config'} 
            className="text-green-600 hover:text-green-800 font-medium text-sm"
          >
            Manage Configurations &rarr;
          </button>
        </div>

        {/* Card 3: Application Health (Placeholder) */}
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center mb-4">
            <ShieldCheckIcon />
            <h2 className="ml-3 text-xl font-semibold text-gray-700">Application Health</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Monitor application status, error logs, and performance metrics. (This section is a placeholder for future monitoring tools).
          </p>
          <span className="text-red-600 font-medium text-sm">View Health Status (Coming Soon)</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Important Notes for Super Admin</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm">
          <li>Changes to configurations can have significant impact on the application. Proceed with caution.</li>
          <li>The Firebase configuration set here is intended for the main application. The Super Admin panel itself uses its pre-configured Firebase settings (from firebase.ts) to operate.</li>
          <li>Ensure all API keys and sensitive credentials are handled securely and are not exposed client-side unless absolutely necessary and appropriately secured.</li>
          <li>Regularly review user access and audit logs (when implemented) for security purposes.</li>
        </ul>
      </div>

    </div>
  );
}
