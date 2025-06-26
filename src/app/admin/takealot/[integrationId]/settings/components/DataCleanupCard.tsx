'use client';

import React, { useState } from 'react';
import { 
  FiTrash2, FiPackage, FiShoppingCart, FiRefreshCw,
  FiSettings
} from 'react-icons/fi';

interface CleanupOperation {
  isRunning: boolean;
  progress: number;
  message: string;
  logs: string[];
  duplicatesRemoved?: number;
  batchesProcessed?: number;
  totalRemaining?: number;
  lastResult?: {
    timestamp: string;
    duplicatesRemoved: number;
    totalRemaining: number;
    batchesProcessed: number;
  };
}

interface DataCleanupCardProps {
  integrationId: string;
  showMessage: (type: 'success' | 'error', message: string) => void;
  loadApiLogs: () => void;
}

export default function DataCleanupCard({ integrationId, showMessage, loadApiLogs }: DataCleanupCardProps) {
  const [cleanupOperations, setCleanupOperations] = useState<{
    [key: string]: CleanupOperation;
  }>({});

  // Handle duplicate cleanup operations matching existing pattern
  const handleDuplicateCleanup = async (type: 'sales' | 'products') => {
    if (!integrationId) {
      showMessage('error', 'Integration ID is missing.');
      return;
    }

    const endpoint = type === 'sales' 
      ? '/api/admin/takealot/fix-duplicate-sales'
      : '/api/admin/takealot/fix-duplicate-products';

    const operationKey = `duplicate_${type}`;
    const confirmMessage = type === 'sales'
      ? 'Are you sure you want to remove duplicate sales records? This will delete sales with duplicate Order IDs.'
      : 'Are you sure you want to remove duplicate products? This will delete products with duplicate TSIN IDs.';

    if (!confirm(confirmMessage)) {
      return;
    }

    // Initialize cleanup operation state
    setCleanupOperations(prev => ({
      ...prev,
      [operationKey]: {
        isRunning: true,
        progress: 0,
        message: 'Starting cleanup operation...',
        logs: [`Starting ${type} duplicate removal...`],
        duplicatesRemoved: 0,
        batchesProcessed: 0,
        totalRemaining: 0
      }
    }));

    try {
      console.log(`Starting ${type} duplicate cleanup`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ integrationId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              setCleanupOperations(prev => ({
                ...prev,
                [operationKey]: {
                  isRunning: !data.completed,
                  progress: data.progress || 0,
                  message: data.message || 'Processing...',
                  logs: [...(prev[operationKey]?.logs || []), data.log || data.message].slice(-10),
                  duplicatesRemoved: data.duplicatesRemoved || 0,
                  batchesProcessed: data.batchesProcessed || 0,
                  totalRemaining: data.totalRemaining || 0
                }
              }));

              if (data.completed) {
                if (data.error) {
                  showMessage('error', `${type} cleanup failed: ${data.message}`);
                } else {
                  const message = `${type} cleanup completed! Removed ${data.duplicatesRemoved || 0} duplicates, ${data.totalRemaining || 0} records remain`;
                  showMessage('success', message);
                  
                  // Save cleanup result for display
                  setCleanupOperations(prev => ({
                    ...prev,
                    [operationKey]: {
                      ...prev[operationKey],
                      lastResult: {
                        timestamp: new Date().toLocaleString(),
                        duplicatesRemoved: data.duplicatesRemoved || 0,
                        totalRemaining: data.totalRemaining || 0,
                        batchesProcessed: data.batchesProcessed || 0
                      }
                    }
                  }));
                  
                  // Reload API logs after successful completion
                  loadApiLogs();
                }
                break;
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`${type} cleanup error:`, error);
      showMessage('error', `${type} cleanup failed: ${error.message}`);
      
      setCleanupOperations(prev => ({
        ...prev,
        [operationKey]: {
          ...prev[operationKey],
          isRunning: false,
          message: `Error: ${error.message}`
        }
      }));
    }
  };

  const handleClearAllData = async (type: 'sales' | 'products') => {
    const endpoint = type === 'sales' 
      ? '/api/admin/takealot/clear-sales-data'
      : '/api/admin/takealot/delete-all-products';
    
    const confirmMessage = type === 'sales'
      ? 'Are you sure you want to delete ALL sales data for this integration? This action cannot be undone.'
      : 'Are you sure you want to delete ALL products for this integration? This action cannot be undone.';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showMessage('success', result.message || `All ${type} data cleared successfully`);
      } else {
        showMessage('error', `Failed to clear ${type} data: ${result.error}`);
      }
    } catch (error: any) {
      showMessage('error', `Error clearing ${type} data: ${error.message}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 ease-in-out">
      <div className="border-b border-gray-100 pb-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-md">
              <FiRefreshCw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Data Cleanup</h2>
              <p className="text-sm text-gray-500">Advanced tools for data integrity and management.</p>
            </div>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-red-100 to-orange-100 text-red-800 border border-red-200">
            Enhanced
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Fix Duplicate Products */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200/80 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center space-x-4 mb-5">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <FiPackage className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Fix Product Duplicates</h3>
              <p className="text-sm text-gray-600">Remove duplicate products by TSIN.</p>
            </div>
          </div>
          
          {cleanupOperations['duplicate_products']?.lastResult && (
            <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200 shadow-inner">
              <div className="text-blue-800 font-medium text-xs mb-1">
                Last Run: <span className="font-semibold">{cleanupOperations['duplicate_products'].lastResult.timestamp}</span>
              </div>
              <div className="text-xs">
                <span className="font-semibold text-red-600">{cleanupOperations['duplicate_products'].lastResult.duplicatesRemoved}</span> removed, 
                <span className="font-semibold text-green-600">{cleanupOperations['duplicate_products'].lastResult.totalRemaining}</span> remaining.
              </div>
            </div>
          )}
          
          <button
            onClick={() => handleDuplicateCleanup('products')}
            disabled={cleanupOperations['duplicate_products']?.isRunning}
            className={`w-full text-sm font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md ${
              cleanupOperations['duplicate_products']?.isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white transform hover:-translate-y-0.5'
            } focus:outline-none focus:ring-4 focus:ring-blue-300`}
          >
            {cleanupOperations['duplicate_products']?.isRunning ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Fixing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <FiSettings className="w-4 h-4" />
                <span>Fix Product Data</span>
              </div>
            )}
          </button>

          {/* Progress Bar and Logs for Products */}
          {cleanupOperations['duplicate_products']?.isRunning && (
            <div className="mt-4 space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${cleanupOperations['duplicate_products']?.progress || 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-center text-gray-600">{cleanupOperations['duplicate_products']?.message}</div>
            </div>
          )}
        </div>

        {/* Fix Duplicate Sales */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200/80 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center space-x-4 mb-5">
            <div className="p-3 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl shadow-lg">
              <FiShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Fix Sales Duplicates</h3>
              <p className="text-sm text-gray-600">Remove duplicate sales by Order ID.</p>
            </div>
          </div>

          {cleanupOperations['duplicate_sales']?.lastResult && (
            <div className="bg-green-50 rounded-lg p-3 mb-4 border border-green-200 shadow-inner">
              <div className="text-green-800 font-medium text-xs mb-1">
                Last Run: <span className="font-semibold">{cleanupOperations['duplicate_sales'].lastResult.timestamp}</span>
              </div>
              <div className="text-xs">
                <span className="font-semibold text-red-600">{cleanupOperations['duplicate_sales'].lastResult.duplicatesRemoved}</span> removed, 
                <span className="font-semibold text-green-600">{cleanupOperations['duplicate_sales'].lastResult.totalRemaining}</span> remaining.
              </div>
            </div>
          )}

          <button
            onClick={() => handleDuplicateCleanup('sales')}
            disabled={cleanupOperations['duplicate_sales']?.isRunning}
            className={`w-full text-sm font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md ${
              cleanupOperations['duplicate_sales']?.isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-teal-700 hover:from-green-700 hover:to-teal-800 text-white transform hover:-translate-y-0.5'
            } focus:outline-none focus:ring-4 focus:ring-green-300`}
          >
            {cleanupOperations['duplicate_sales']?.isRunning ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Fixing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <FiSettings className="w-4 h-4" />
                <span>Fix Sales Data</span>
              </div>
            )}
          </button>

          {/* Progress Bar and Logs for Sales */}
          {cleanupOperations['duplicate_sales']?.isRunning && (
            <div className="mt-4 space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-gradient-to-r from-green-500 to-teal-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${cleanupOperations['duplicate_sales']?.progress || 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-center text-gray-600">{cleanupOperations['duplicate_sales']?.message}</div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-10 pt-8 border-t border-dashed border-red-300">
        <h3 className="text-lg font-semibold text-red-700 mb-4">Danger Zone</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-red-50 rounded-2xl border border-red-200/80">
          {/* Clear All Products */}
          <div>
            <h4 className="font-bold text-gray-800">Clear All Products</h4>
            <p className="text-sm text-red-600 mt-1 mb-3">Permanently delete all product data for this integration.</p>
            <button
              onClick={() => handleClearAllData('products')}
              className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform hover:scale-105"
            >
              <FiTrash2 className="w-4 h-4 mr-2 inline" />
              Delete All Products
            </button>
          </div>

          {/* Clear All Sales */}
          <div>
            <h4 className="font-bold text-gray-800">Clear All Sales</h4>
            <p className="text-sm text-red-600 mt-1 mb-3">Permanently delete all sales data for this integration.</p>
            <button
              onClick={() => handleClearAllData('sales')}
              className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform hover:scale-105"
            >
              <FiTrash2 className="w-4 h-4 mr-2 inline" />
              Delete All Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
