// src/app/admin/takealot/[integrationId]/layout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface TakealotIntegration {
  id: string;
  accountName: string;
  assignedUserId: string;
  adminId: string;
}

export default function TakealotIntegrationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ integrationId: string }>;
}) {
  const { currentUser } = useAuth();
  const { setAccountName } = usePageTitle();
  const router = useRouter();
  const [integration, setIntegration] = useState<TakealotIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState<string>('');

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setIntegrationId(resolvedParams.integrationId);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!currentUser?.uid || !integrationId) return;

    const fetchIntegration = async () => {
      try {
        const integrationDoc = await getDoc(doc(db, 'takealotIntegrations', integrationId));
        
        if (!integrationDoc.exists()) {
          setError('Integration not found');
          return;
        }

        const integrationData = integrationDoc.data() as TakealotIntegration;
        
        // Check if user has access to this integration
        if (integrationData.adminId !== currentUser.uid && integrationData.assignedUserId !== currentUser.uid) {
          setError('Access denied to this integration');
          return;
        }

        setIntegration({
          ...integrationData,
          id: integrationDoc.id,
        });
        
        // Set the account name in the page title context
        console.log('Setting account name:', integrationData.accountName);
        setAccountName(integrationData.accountName);
      } catch (err: any) {
        console.error('Error fetching integration:', err);
        setError('Failed to load integration');
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntegration();
  }, [currentUser?.uid, integrationId, setAccountName]);

  // Clear account name when component unmounts
  useEffect(() => {
    return () => {
      setAccountName('');
    };
  }, [setAccountName]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.234 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {error || 'Integration not found'}
        </h3>
        <button
          onClick={() => router.push('/admin/integration')}
          className="text-blue-600 hover:text-blue-800"
        >
          Back to Integrations
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg">
      {children}
    </div>
  );
}
