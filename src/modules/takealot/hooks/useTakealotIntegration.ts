// src/modules/takealot/hooks/useTakealotIntegration.ts
// Hook for managing Takealot integration data

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

export interface TakealotIntegration {
  id: string;
  accountName: string;
  assignedUserId: string;
  adminId: string;
  apiKey?: string;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const useTakealotIntegration = (integrationId: string) => {
  const [integration, setIntegration] = useState<TakealotIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIntegration = async () => {
      if (!integrationId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const docRef = doc(db, 'takealotIntegrations', integrationId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setIntegration({
            id: docSnap.id,
            accountName: data.accountName,
            assignedUserId: data.assignedUserId,
            adminId: data.adminId,
            apiKey: data.apiKey,
            status: data.status,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        } else {
          setError('Integration not found');
        }
      } catch (err: any) {
        console.error('Error fetching integration:', err);
        setError('Failed to load integration details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntegration();
  }, [integrationId]);

  return { integration, isLoading, error };
};
