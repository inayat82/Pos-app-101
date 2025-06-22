'use client';

import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/user';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { currentUser, userProfile, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
        <p className="text-xl text-gray-700">Loading dashboard...</p>
      </div>
    );
  }

  // If not loading and no user, or user is not an Admin, redirect to login or home
  if (!currentUser || !userProfile) {
    router.replace('/login'); // Or router.replace('/');
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
            <p className="text-xl text-gray-700">Redirecting...</p>
        </div>
    ); 
  }

  if (userProfile.role !== UserRole.Admin) {
    // If user is logged in but not an Admin, redirect to home or an unauthorized page
    router.replace('/'); 
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
            <p className="text-xl text-gray-700">Unauthorized. Redirecting...</p>
        </div>
    );
  }

  // User is an Admin
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <header className="mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <Link href="/" className="text-indigo-600 hover:text-indigo-500">
            Back to Home
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Welcome, {userProfile.displayName || currentUser.email}!
          </h2>
          <p className="text-gray-600 mb-2">This is your Admin control panel.</p>
          <p className="text-gray-600 mb-6">From here, you can manage your sub-users (Takealot Users and POS Users) and your shared POS data.</p>
          
          {/* Placeholder sections for Admin functionalities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Manage Sub-Users</h3>
              <p className="text-sm text-gray-500 mb-3">Create, view, and manage your Takealot and POS users.</p>
              <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                Go to User Management
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Manage POS Data</h3>
              <p className="text-sm text-gray-500 mb-3">Access and manage the common POS data for your team.</p>
              <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                Go to POS Data
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-700 mb-2">View Takealot User Data</h3>
              <p className="text-sm text-gray-500 mb-3">View the unique Takealot data for each of your Takealot Users.</p>
              <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                View Takealot Data
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
