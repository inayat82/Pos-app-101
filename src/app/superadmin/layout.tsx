// src/app/superadmin/layout.tsx
"use client";
import React, { useContext, useEffect } from 'react';
import SuperAdminSidebar from '@/components/superadmin/SuperAdminSidebar';
import SuperAdminTopbar from '@/components/superadmin/SuperAdminTopbar';
import { AuthContext } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types/user'; // Assuming you have UserRole defined

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading, userRole } = useContext(AuthContext) ?? {};
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.push('/login');
      } else if (userRole !== UserRole.SUPERADMIN) {
        // Redirect to a relevant page or show an unauthorized message
        // For now, redirecting to admin dashboard as a fallback, 
        // but ideally should be a specific unauthorized page or home.
        console.warn("User is not a SuperAdmin. Redirecting...");
        router.push('/admin/dashboard'); 
      }
    }
  }, [currentUser, loading, userRole, router]);

  if (loading || !currentUser || userRole !== UserRole.SUPERADMIN) {
    // Show a loading spinner or a blank page while checking auth/role
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-600">Loading or Verifying Access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SuperAdminTopbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
