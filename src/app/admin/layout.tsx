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
  // Explicitly type the context value
  const context = useContext(AuthContext);

  // Add a check to ensure context is not undefined before destructuring
  if (!context) {
    // This case should ideally not happen if AuthProvider wraps the app
    // but it's a good safeguard.
    // You might want to redirect to an error page or show a loading state.
    // For now, let's prevent a crash and redirect to login.
    const router = useRouter();
    useEffect(() => {
      router.replace('/auth/login'); // Corrected redirect path
    }, [router]);
    return <div className="flex justify-center items-center h-screen bg-slate-100">Auth context not available. Redirecting...</div>;
  }

  const { currentUser, userProfile, loading, emailVerified } = context as AuthContextType;
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!currentUser || userProfile?.role !== UserRole.Admin) { // Use UserRole.Admin
      router.replace('/auth/login'); // Corrected redirect path
    } else if (!emailVerified) {
      router.replace('/auth/login'); // Corrected redirect path (or a dedicated verify-email page)
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
  const context = useContext(AuthContext);
  const { pageTitle } = usePageTitle();

  if (!context) {
    const router = useRouter();
    useEffect(() => {
      router.replace('/auth/login');
    }, [router]);
    return <div className="flex justify-center items-center h-screen bg-slate-100">Auth context not available. Redirecting...</div>;
  }

  const { currentUser, userProfile, loading, emailVerified } = context as AuthContextType;
  const router = useRouter();

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

  if (!currentUser || userProfile?.role !== UserRole.Admin || !emailVerified) {
    return <div className="flex justify-center items-center h-screen bg-slate-100">Verifying access or redirecting...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar pageTitle={pageTitle} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-2 md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
