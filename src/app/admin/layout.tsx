'use client';

import React, { ReactNode, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AuthContext } from '@/context/AuthContext';
import type { AuthContextType } from '@/context/AuthContext'; // Import the type
import Topbar from "@/components/Topbar";
import { UserRole } from '@/types/user'; // Import UserRole
import { PageTitleProvider, usePageTitle } from '@/context/PageTitleContext';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  // All hooks must be called at the top level
  const context = useContext(AuthContext);
  const router = useRouter();

  // Handle the case where context is not available
  useEffect(() => {
    if (!context) {
      router.replace('/auth/login');
    }
  }, [context, router]);

  // If context is not available, show loading/redirecting message
  if (!context) {
    return <div className="flex justify-center items-center h-screen bg-slate-100">Auth context not available. Redirecting...</div>;
  }

  const { currentUser, userProfile, loading, emailVerified } = context as AuthContextType;

  useEffect(() => {
    if (loading) return;

    if (!currentUser || userProfile?.role !== UserRole.Admin) {
      router.replace('/auth/login');
    } else if (!emailVerified) {
      router.replace('/auth/login');
    }
  }, [currentUser, userProfile, loading, emailVerified, router]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-slate-100">Loading...</div>;
  }

  // Check if user is not an admin or email is not verified
  if (!currentUser || userProfile?.role !== UserRole.Admin || !emailVerified) {
    // User is not an admin or email not verified, show verifying/redirecting message
    // The useEffect above will handle the redirection.
    return <div className="flex justify-center items-center h-screen bg-slate-100">Verifying access or redirecting...</div>;
  }
  return (
    <PageTitleProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </PageTitleProvider>
  );
};

const AdminLayoutContent: React.FC<AdminLayoutProps> = ({ children }) => {
  // All hooks must be called at the top level
  const context = useContext(AuthContext);
  const { pageTitle, accountName } = usePageTitle();
  const router = useRouter();
  
  // Debug logging
  console.log('AdminLayout - pageTitle:', pageTitle, 'accountName:', accountName);

  // Handle the case where context is not available
  useEffect(() => {
    if (!context) {
      router.replace('/auth/login');
      return;
    }

    const { currentUser, userProfile, loading, emailVerified } = context as AuthContextType;

    if (loading) return;

    if (!currentUser || userProfile?.role !== UserRole.Admin) {
      router.replace('/auth/login');
    } else if (!emailVerified) {
      router.replace('/auth/login');
    }
  }, [context, router]);

  // If context is not available, show loading/redirecting message
  if (!context) {
    return <div className="flex justify-center items-center h-screen bg-slate-100">Auth context not available. Redirecting...</div>;
  }

  const { currentUser, userProfile, loading, emailVerified } = context as AuthContextType;

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-slate-100">Loading...</div>;
  }

  if (!currentUser || userProfile?.role !== UserRole.Admin || !emailVerified) {
    return <div className="flex justify-center items-center h-screen bg-slate-100">Verifying access or redirecting...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar pageTitle={pageTitle} accountName={accountName} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-2 md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
