'use client';

import React, { useState } from 'react';
import { FiPlay, FiCheck, FiX, FiLoader, FiRefreshCw } from 'react-icons/fi';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  details?: any;
  error?: string;
  duration?: number;
}

export default function DualWriteTestPage() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Enhanced Sync - Products', status: 'pending' },
    { name: 'Enhanced Sync - Sales', status: 'pending' },
    { name: 'Manual Product Sync', status: 'pending' },
    { name: 'Manual Sales Sync', status: 'pending' },
    { name: 'Neon Data Access', status: 'pending' },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  const updateTest = (name: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.name === name ? { ...test, ...updates } : test
    ));
  };

  const runTest = async (testName: string, apiCall: () => Promise<any>) => {
    setCurrentTest(testName);
    updateTest(testName, { status: 'running' });
    
    const startTime = Date.now();
    
    try {
      const result = await apiCall();
      const duration = Date.now() - startTime;
      
      if (result.success !== false) {
        updateTest(testName, { 
          status: 'success', 
          details: result,
          duration 
        });
      } else {
        updateTest(testName, { 
          status: 'failed', 
          error: result.error || 'Test failed',
          duration 
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      updateTest(testName, { 
        status: 'failed', 
        error: error.message,
        duration 
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTests(prev => prev.map(test => ({ ...test, status: 'pending' })));

    // Test 1: Enhanced Sync Products
    await runTest('Enhanced Sync - Products', async () => {
      const response = await fetch('/api/test-enhanced-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'HFtQTUMDN21vbKCDNzv3',
          strategy: 'Fetch 100 Products',
          dataType: 'products'
        })
      });
      return await response.json();
    });

    // Test 2: Enhanced Sync Sales
    await runTest('Enhanced Sync - Sales', async () => {
      const response = await fetch('/api/test-enhanced-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'HFtQTUMDN21vbKCDNzv3',
          strategy: 'Last 100',
          dataType: 'sales'
        })
      });
      return await response.json();
    });

    // Test 3: Manual Product Sync
    await runTest('Manual Product Sync', async () => {
      const response = await fetch('/api/admin/takealot/manual-product-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'XsGCVrhDVP9g9jAS6HCp',
          strategy: 'Fetch 100 Products'
        })
      });
      return await response.json();
    });

    // Test 4: Manual Sales Sync
    await runTest('Manual Sales Sync', async () => {
      const response = await fetch('/api/admin/takealot/manual-sales-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'XsGCVrhDVP9g9jAS6HCp',
          strategy: 'Last 100'
        })
      });
      return await response.json();
    });

    // Test 5: Neon Data Access
    await runTest('Neon Data Access', async () => {
      const [productsResponse, salesResponse] = await Promise.all([
        fetch('/api/takealot/products/HFtQTUMDN21vbKCDNzv3'),
        fetch('/api/takealot/sales/HFtQTUMDN21vbKCDNzv3')
      ]);
      
      const [productsResult, salesResult] = await Promise.all([
        productsResponse.json(),
        salesResponse.json()
      ]);

      return {
        success: true,
        products: productsResult.products?.length || 0,
        sales: salesResult.sales?.length || 0
      };
    });

    setCurrentTest(null);
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full bg-gray-300"></div>;
      case 'running':
        return <FiLoader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <FiCheck className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <FiX className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'border-gray-200 bg-gray-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const failedCount = tests.filter(t => t.status === 'failed').length;
  const totalTests = tests.length;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dual-Write Implementation Test</h1>
              <p className="text-gray-600 mt-2">Test the enhanced sync functionality and dual-write implementation</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {successCount}/{totalTests}
              </div>
              <div className="text-sm text-gray-500">Tests Passed</div>
            </div>
          </div>

          <div className="mb-6">
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className={`flex items-center px-4 py-2 rounded-lg font-medium ${
                isRunning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRunning ? (
                <>
                  <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <FiPlay className="w-4 h-4 mr-2" />
                  Run All Tests
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {tests.map((test, index) => (
              <div
                key={test.name}
                className={`border rounded-lg p-4 transition-all ${getStatusColor(test.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(test.status)}
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900">{test.name}</h3>
                      {test.status === 'running' && currentTest === test.name && (
                        <p className="text-sm text-blue-600">Running...</p>
                      )}
                      {test.duration && (
                        <p className="text-sm text-gray-500">Completed in {test.duration}ms</p>
                      )}
                    </div>
                  </div>
                  
                  {test.status === 'success' && test.details && (
                    <div className="text-right text-sm">
                      {test.details.testResults?.totalRecords && (
                        <div className="text-gray-600">
                          Total: {test.details.testResults.totalRecords}
                        </div>
                      )}
                      {test.details.testResults?.neonRecords && (
                        <div className="text-green-600">
                          Neon: {test.details.testResults.neonRecords}
                        </div>
                      )}
                      {test.details.testResults?.firebaseRecords && (
                        <div className="text-blue-600">
                          Firebase: {test.details.testResults.firebaseRecords}
                        </div>
                      )}
                      {test.details.products && (
                        <div className="text-green-600">
                          Products: {test.details.products}
                        </div>
                      )}
                      {test.details.sales && (
                        <div className="text-blue-600">
                          Sales: {test.details.sales}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {test.error && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                    <strong>Error:</strong> {test.error}
                  </div>
                )}

                {test.status === 'success' && test.details?.testResults?.strategy && (
                  <div className="mt-2 p-2 bg-green-100 border border-green-200 rounded text-sm text-green-700">
                    <strong>Strategy:</strong> {test.details.testResults.strategy}
                    {test.details.testResults.warnings?.length > 0 && (
                      <div className="mt-1">
                        <strong>Warnings:</strong> {test.details.testResults.warnings.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {failedCount > 0 && !isRunning && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">Test Failures Detected</h3>
              <p className="text-red-700 text-sm">
                {failedCount} test(s) failed. Please check:
              </p>
              <ul className="text-red-700 text-sm mt-2 list-disc list-inside">
                <li>Your development server is running</li>
                <li>Your Neon database connection is working</li>
                <li>Your integration IDs are correct</li>
                <li>Your API keys are valid</li>
              </ul>
            </div>
          )}

          {successCount === totalTests && !isRunning && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">🎉 All Tests Passed!</h3>
              <p className="text-green-700 text-sm">
                Your dual-write implementation is working correctly. New data will be written to both Neon and Firebase.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
