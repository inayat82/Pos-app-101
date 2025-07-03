'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Import all modular components
import IntegrationSettingsCard from './components/IntegrationSettingsCard';
import APIDataChecksCard from './components/APIDataChecksCard';
import SyncStrategyPreferencesCard from './components/SyncStrategyPreferencesCard';
import APICallLogsCard from './components/APICallLogsCard';
import DataCleanupCard from './components/DataCleanupCard';

interface SettingsPageProps {
  params: Promise<{
    integrationId: string;
  }>;
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const [integrationId, setIntegrationId] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Message state for components
  const [generalUIMessage, setGeneralUIMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  // Extract integrationId from params
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setIntegrationId(resolvedParams.integrationId);
    };
    getParams();
  }, [params]);

  // Set page title
  useEffect(() => {
    setPageTitle('Takealot Settings');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Fetch integration data to get API key
  useEffect(() => {
    const fetchIntegrationData = async () => {
      if (!integrationId || !currentUser?.uid) return;
      
      setIsLoading(true);
      try {
        const integrationDocRef = doc(db, 'takealotIntegrations', integrationId);
        const integrationDocSnap = await getDoc(integrationDocRef);
        
        if (integrationDocSnap.exists()) {
          const data = integrationDocSnap.data();
          setApiKey(data.apiKey || '');
        }
      } catch (error) {
        console.error('Error fetching integration data:', error);
        showMessage('error', 'Failed to load integration data');
      } finally {
        setIsLoading(false);
      }
    };

    if (integrationId) {
      fetchIntegrationData();
    }
  }, [integrationId, currentUser?.uid]);

  // Shared message function for components
  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setGeneralUIMessage({ type, text });
    setTimeout(() => setGeneralUIMessage({ type: null, text: '' }), 5000);
  }, []);

  // Mock loadApiLogs function - will be shared between components
  const loadApiLogs = useCallback(async (page: number = 1) => {
    if (!integrationId) return;
    
    try {
      console.log(`Loading API logs for integration: ${integrationId}, page: ${page}`);
      const response = await fetch(`/api/admin/takealot/fetch-logs?integrationId=${integrationId}&limit=10&page=${page}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API logs loaded successfully');
      } else {
        console.error('Failed to load API logs');
      }
    } catch (error) {
      console.error('Error loading API logs:', error);
    }
  }, [integrationId]);

  if (!integrationId || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {generalUIMessage.type && (
        <div className={`p-4 rounded-xl border shadow-sm ${
          generalUIMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-3 ${
              generalUIMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium">{generalUIMessage.text}</span>
          </div>
        </div>
      )}

      {/* Simple Content Display - No Tabs, Just Stack Cards Vertically */}
      <div className="space-y-6">
        {/* Integration Settings */}
        <IntegrationSettingsCard 
          integrationId={integrationId}
          currentUser={currentUser}
          showMessage={showMessage}
        />

        {/* API Data Checks */}
        <APIDataChecksCard 
          integrationId={integrationId}
          apiKey={apiKey}
          showMessage={showMessage}
          loadApiLogs={loadApiLogs}
        />

        {/* Sync Strategy Preferences */}
        <SyncStrategyPreferencesCard 
          integrationId={integrationId}
          showMessage={showMessage}
          loadApiLogs={loadApiLogs}
        />
        
        {/* API Call Logs */}
        <APICallLogsCard 
          integrationId={integrationId}
          showMessage={showMessage}
        />

        {/* Data Cleanup */}
        <DataCleanupCard 
          integrationId={integrationId}
          showMessage={showMessage}
          loadApiLogs={loadApiLogs}
        />
      </div>
    </div>
  );
}
