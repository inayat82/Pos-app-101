'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface StrategyTestResult {
  strategy: string;
  startTime: string;
  endTime: string;
  duration: string;
  totalFetched: number;
  totalNew: number;
  totalUpdated: number;
  totalErrors: number;
  totalSkipped: number;
  pagesChecked: number;
  chunksProcessed?: number;
  apiCalls: number;
  proxyUsed?: string;
  proxyCountry?: string;
  success: boolean;
  error?: string;
  logs: string[];
  metrics: {
    avgRecordsPerPage?: number;
    avgChunkSize?: number;
    efficiency?: number;
  };
}

interface TestSummary {
  testRunId: string;
  integrationId: string;
  adminId: string;
  totalStrategiesTested: number;
  totalTestDuration: string;
  overallResults: {
    totalRecordsFetched: number;
    totalApiCalls: number;
    totalErrors: number;
    successfulStrategies: number;
    failedStrategies: number;
  };
  strategyResults: StrategyTestResult[];
  logsSavedTo: string[];
}

interface Integration {
  id: string;
  accountName: string;
  adminId: string;
  apiKey?: string;
  lastSync?: string;
}

export default function TestAllStrategiesPage() {
  const { currentUser } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestSummary | null>(null);
  const [integrationId, setIntegrationId] = useState('');
  const [error, setError] = useState('');
  const [currentStrategy, setCurrentStrategy] = useState('');
  const [availableIntegrations, setAvailableIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);

  // Fetch available integrations for current user
  useEffect(() => {
    if (currentUser?.uid) {
      fetchIntegrations();
    }
  }, [currentUser]);

  const fetchIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const response = await fetch(`/api/admin/takealot/list-integrations?adminId=${currentUser?.uid}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableIntegrations(data.integrations || []);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const runAllTests = async () => {
    if (!integrationId.trim()) {
      setError('Please enter an Integration ID');
      return;
    }

    if (!currentUser?.uid) {
      setError('No authenticated user found');
      return;
    }

    setTesting(true);
    setError('');
    setTestResults(null);
    setCurrentStrategy('Initializing...');

    try {
      console.log('Starting comprehensive strategy test...');
      
      const response = await fetch('/api/admin/takealot/test-all-strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId: integrationId.trim(),
          adminId: currentUser.uid
        })
      });

      const result = await response.json();

      if (result.success) {
        setTestResults(result.testSummary);
        setCurrentStrategy('');
      } else {
        setError(result.error || 'Test failed');
      }

    } catch (err: any) {
      console.error('Test error:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setTesting(false);
      setCurrentStrategy('');
    }
  };

  const formatDuration = (duration: string) => {
    return duration.replace(' seconds', 's');
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'Last 100': return '🚀';
      case 'Last 30 Days': return '📅';
      case 'Last 6 Months': return '📊';
      case 'All Data': return '🗄️';
      default: return '🔄';
    }
  };

  const getSuccessColor = (success: boolean) => {
    return success ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              🧪 Takealot Sync Strategy Comprehensive Testing
            </h1>
            <p className="text-gray-600">
              Test all 4 sync strategies systematically and get detailed performance metrics
            </p>
          </div>

          <div className="p-6">
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Integration ID
                </label>
                <input
                  type="text"
                  value={integrationId}
                  onChange={(e) => setIntegrationId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your Takealot integration ID"
                  disabled={testing}
                />
              </div>

              {/* Quick Test Options */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIntegrationId('test-integration-001')}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Use Test ID
                </button>
                <span className="text-xs text-gray-500">
                  (For demo purposes - use your actual integration ID for real tests)
                </span>
              </div>

              {/* Available Integrations */}
              {currentUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Integrations {loadingIntegrations && <span className="text-gray-500">(Loading...)</span>}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableIntegrations.map((integration) => (
                      <div
                        key={integration.id}
                        onClick={() => setIntegrationId(integration.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          integrationId === integration.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900">{integration.accountName}</div>
                        <div className="text-xs text-gray-500 font-mono">{integration.id}</div>
                        {integration.lastSync && (
                          <div className="text-xs text-gray-400 mt-1">
                            Last sync: {new Date(integration.lastSync).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {availableIntegrations.length === 0 && !loadingIntegrations && (
                    <p className="text-gray-500 text-sm">No integrations found. Please set up a Takealot integration first.</p>
                  )}
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={runAllTests}
                  disabled={testing || !integrationId.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {testing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Run All Tests</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Current Strategy Status */}
            {testing && currentStrategy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-blue-800 font-medium">Testing: {currentStrategy}</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-red-600">❌</span>
                  <span className="text-red-800 font-medium">Error:</span>
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Results */}
        {testResults && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">📊 Test Results Summary</h2>
                <div className="text-sm text-gray-500">
                  Test Run ID: <code className="bg-gray-100 px-2 py-1 rounded">{testResults.testRunId}</code>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Overall Results */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{testResults.overallResults.totalRecordsFetched}</div>
                  <div className="text-sm text-blue-800">Total Records</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{testResults.overallResults.totalApiCalls}</div>
                  <div className="text-sm text-green-800">API Calls</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{testResults.overallResults.successfulStrategies}</div>
                  <div className="text-sm text-purple-800">Successful</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{testResults.overallResults.failedStrategies}</div>
                  <div className="text-sm text-red-800">Failed</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{testResults.totalTestDuration}</div>
                  <div className="text-sm text-gray-800">Total Time</div>
                </div>
              </div>

              {/* Individual Strategy Results */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Individual Strategy Results</h3>
                {testResults.strategyResults.map((result, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getStrategyIcon(result.strategy)}</span>
                        <h4 className="text-lg font-semibold text-gray-900">{result.strategy}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSuccessColor(result.success)}`}>
                          {result.success ? '✅ SUCCESS' : '❌ FAILED'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Duration: <span className="font-medium">{formatDuration(result.duration)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{result.totalFetched}</div>
                        <div className="text-xs text-gray-600">Fetched</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{result.totalNew}</div>
                        <div className="text-xs text-gray-600">New</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-600">{result.totalUpdated}</div>
                        <div className="text-xs text-gray-600">Updated</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-600">{result.totalSkipped}</div>
                        <div className="text-xs text-gray-600">Skipped</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">{result.pagesChecked}</div>
                        <div className="text-xs text-gray-600">Pages</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-indigo-600">{result.apiCalls}</div>
                        <div className="text-xs text-gray-600">API Calls</div>
                      </div>
                    </div>

                    {/* Proxy Information */}
                    {result.proxyUsed && (
                      <div className="mb-3">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Proxy:</span> {result.proxyUsed}
                          {result.proxyCountry && <span className="ml-2">🌍 {result.proxyCountry}</span>}
                        </div>
                      </div>
                    )}

                    {/* Chunks Information */}
                    {result.chunksProcessed && (
                      <div className="mb-3">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Chunks Processed:</span> {result.chunksProcessed}
                          {result.metrics.avgChunkSize && (
                            <span className="ml-2">
                              (Avg: {result.metrics.avgChunkSize} records/chunk)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error Details */}
                    {!result.success && result.error && (
                      <div className="mb-3 p-3 bg-red-100 border border-red-200 rounded">
                        <div className="text-sm text-red-800">
                          <span className="font-medium">Error:</span> {result.error}
                        </div>
                      </div>
                    )}

                    {/* Recent Logs Preview */}
                    {result.logs && result.logs.length > 0 && (
                      <div className="border-t pt-3">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
                            View Logs ({result.logs.length} entries)
                          </summary>
                          <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded text-xs font-mono">
                            {result.logs.slice(-10).map((log, logIndex) => (
                              <div key={logIndex} className="text-gray-700">{log}</div>
                            ))}
                            {result.logs.length > 10 && (
                              <div className="text-gray-500 italic">... and {result.logs.length - 10} more entries</div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Test Data Storage Info */}
              <div className="border-t pt-6 mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">📁 Data Storage</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Test results saved to: <code className="bg-gray-200 px-1 rounded">strategyTestResults/{testResults.testRunId}</code></p>
                  <p>• Individual strategy logs available in collection sub-documents</p>
                  <p>• Integration ID: <code className="bg-gray-200 px-1 rounded">{testResults.integrationId}</code></p>
                  <p>• Admin ID: <code className="bg-gray-200 px-1 rounded">{testResults.adminId}</code></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
