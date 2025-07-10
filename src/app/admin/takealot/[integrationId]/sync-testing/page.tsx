'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import EnhancedSyncCard from '@/components/admin/takealot/EnhancedSyncCard';
import SyncPerformanceComparison from '@/components/admin/takealot/SyncPerformanceComparison';
import SyncMonitoringDashboard from '@/components/admin/takealot/SyncMonitoringDashboard';

interface SyncTestingPageProps {
  params: Promise<{
    integrationId: string;
  }>;
}

interface SyncTestResult {
  id: string;
  strategy: 'legacy' | 'enhanced';
  dataType: 'products' | 'sales';
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  status: 'running' | 'completed' | 'failed';
}

export default function SyncTestingPage({ params }: SyncTestingPageProps) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const [integrationId, setIntegrationId] = useState<string>('');
  const [testResults, setTestResults] = useState<SyncTestResult[]>([]);
  const [isRunningBatch, setIsRunningBatch] = useState(false);

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
    setPageTitle('Sync Strategy Testing');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const runBatchTest = async () => {
    if (!currentUser || !integrationId) return;
    
    setIsRunningBatch(true);
    
    const tests: Omit<SyncTestResult, 'id'>[] = [
      { strategy: 'enhanced', dataType: 'products', startTime: new Date(), status: 'running' },
      { strategy: 'enhanced', dataType: 'sales', startTime: new Date(), status: 'running' },
    ];

    // Add test results to state
    const newTestResults = tests.map(test => ({
      ...test,
      id: `${test.strategy}-${test.dataType}-${Date.now()}`
    }));
    
    setTestResults(prev => [...newTestResults, ...prev]);

    try {
      const idToken = await currentUser.getIdToken();
      
      // Run tests sequentially to avoid overwhelming the system
      for (const test of newTestResults) {
        try {
          const response = await fetch('/api/admin/takealot/enhanced-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              integrationId,
              dataType: test.dataType,
              strategy: 'enhanced',
              maxPages: 5, // Limit for testing
              concurrentOptions: {
                maxConcurrentPages: 3,
                batchSize: 50,
                retryAttempts: 2,
                delayBetweenBatches: 1000
              }
            })
          });

          const result = await response.json();
          
          setTestResults(prev => prev.map(t => 
            t.id === test.id 
              ? { 
                  ...t, 
                  endTime: new Date(), 
                  result, 
                  status: result.success ? 'completed' : 'failed',
                  error: result.success ? undefined : result.error 
                }
              : t
          ));
        } catch (error) {
          setTestResults(prev => prev.map(t => 
            t.id === test.id 
              ? { 
                  ...t, 
                  endTime: new Date(), 
                  status: 'failed',
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              : t
          ));
        }
      }
    } finally {
      setIsRunningBatch(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (!integrationId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div className="text-gray-500">Loading testing interface...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sync Strategy Testing</h1>
        <p className="text-gray-600">
          Test and compare the performance of enhanced sync strategies with concurrent processing
          and Neon database integration.
        </p>
      </div>

      {/* Test Controls */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Controls</h2>
        <div className="flex space-x-4">
          <button
            onClick={runBatchTest}
            disabled={isRunningBatch}
            className={`px-6 py-2 rounded-lg font-medium ${
              isRunningBatch
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunningBatch ? 'Running Batch Test...' : 'Run Batch Test'}
          </button>
          
          <button
            onClick={clearResults}
            disabled={isRunningBatch}
            className="px-6 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Individual Sync Cards for Manual Testing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedSyncCard
          integrationId={integrationId}
          title="Test Enhanced Product Sync"
          description="Test concurrent product sync with detailed metrics and performance analysis"
          dataType="products"
        />
        
        <EnhancedSyncCard
          integrationId={integrationId}
          title="Test Enhanced Sales Sync"
          description="Test concurrent sales sync with proxy rotation and Neon database writes"
          dataType="sales"
        />
      </div>

      {/* Performance Comparison */}
      <SyncPerformanceComparison />

      {/* Real-time Monitoring Dashboard */}
      <SyncMonitoringDashboard integrationId={integrationId} />

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>
          <div className="space-y-4">
            {testResults.map((test) => (
              <div
                key={test.id}
                className={`p-4 rounded-lg border ${
                  test.status === 'running'
                    ? 'border-blue-200 bg-blue-50'
                    : test.status === 'completed'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className={`w-3 h-3 rounded-full ${
                      test.status === 'running'
                        ? 'bg-blue-500 animate-pulse'
                        : test.status === 'completed'
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`}></span>
                    <span className="font-medium">
                      {test.strategy.toUpperCase()} - {test.dataType.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {test.endTime ? 
                      `${Math.round((test.endTime.getTime() - test.startTime.getTime()) / 1000)}s` 
                      : 'Running...'
                    }
                  </span>
                </div>
                
                {test.result && (
                  <div className="text-sm space-y-1">
                    <div>Items: {test.result.totalItemsFetched || 0}</div>
                    <div>Neon Records: {test.result.neonRecords || 0}</div>
                    <div>Firebase Records: {test.result.firebaseRecords || 0}</div>
                    <div>Strategy: {test.result.strategy || 'N/A'}</div>
                    {test.result.concurrentPages && (
                      <div>Concurrent Pages: {test.result.concurrentPages}</div>
                    )}
                  </div>
                )}
                
                {test.error && (
                  <div className="text-sm text-red-600 mt-2">
                    Error: {test.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
