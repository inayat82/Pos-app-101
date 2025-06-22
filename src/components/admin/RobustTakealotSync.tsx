// src/components/admin/RobustTakealotSync.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { useRobustTakealotSync, formatSyncResult, formatStatistics } from '@/hooks/useRobustTakealotSync';

interface RobustTakealotSyncProps {
  adminId: string;
  integrationId?: string;
  onSyncComplete?: (result: any) => void;
}

export default function RobustTakealotSync({ adminId, integrationId, onSyncComplete }: RobustTakealotSyncProps) {
  const {
    isLoading,
    isCleaning,
    lastResult,
    lastCleanupResult,
    statistics,
    error,
    startRobustSync,
    cleanupDuplicates,
    getStatistics,
    clearError,
    clearResults
  } = useRobustTakealotSync();

  const [selectedDataType, setSelectedDataType] = useState<'products' | 'sales'>('products');
  const [maxPages, setMaxPages] = useState<string>('');
  const [enableDuplicateCheck, setEnableDuplicateCheck] = useState(true);
  const [updateExistingRecords, setUpdateExistingRecords] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [currentStatistics, setCurrentStatistics] = useState<any>(null);

  // Load initial statistics
  useEffect(() => {
    if (adminId) {
      loadStatistics();
    }
  }, [adminId, selectedDataType]);

  const loadStatistics = async () => {
    try {
      const stats = await getStatistics(adminId, selectedDataType);
      setCurrentStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleStartSync = async () => {
    if (!adminId) {
      console.error('Admin ID is required');
      return;
    }

    try {
      const result = await startRobustSync({
        adminId,
        integrationId,
        dataType: selectedDataType,
        maxPages: maxPages ? parseInt(maxPages) : undefined,
        enableDuplicateCheck,
        updateExistingRecords
      });

      if (onSyncComplete) {
        onSyncComplete(result);
      }

      // Reload statistics after sync
      setTimeout(() => {
        loadStatistics();
      }, 1000);

    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!adminId) {
      console.error('Admin ID is required');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to clean up duplicate ${selectedDataType} records? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await cleanupDuplicates(adminId, selectedDataType);
      
      // Reload statistics after cleanup
      setTimeout(() => {
        loadStatistics();
      }, 1000);

    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  };

  const handleClearResults = () => {
    clearResults();
    setCurrentStatistics(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Robust Takealot Data Sync
          </h3>
          <p className="text-sm text-gray-600">
            Advanced data retrieval with duplicate detection and management
          </p>
        </div>
        <button
          onClick={handleClearResults}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear Results
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-start">
            <div className="flex">
              <div className="text-red-400">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Statistics Display */}
      {currentStatistics && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Current Statistics</h4>
          <p className="text-sm text-blue-700">{formatStatistics(currentStatistics)}</p>
          {currentStatistics.potentialDuplicates > 0 && (
            <div className="mt-2">
              <p className="text-sm text-blue-700 font-medium">
                Found {currentStatistics.potentialDuplicates} potential duplicates
              </p>
              {currentStatistics.duplicateDetails && currentStatistics.duplicateDetails.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-blue-600">Sample duplicates:</p>
                  <ul className="text-xs text-blue-600 ml-4">
                    {currentStatistics.duplicateDetails.slice(0, 3).map((dup: any, index: number) => (
                      <li key={index}>• {dup.field}: {dup.value}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sync Configuration */}
      <div className="space-y-4 mb-6">
        {/* Data Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data Type
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="products"
                checked={selectedDataType === 'products'}
                onChange={(e) => setSelectedDataType(e.target.value as 'products' | 'sales')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Products</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="sales"
                checked={selectedDataType === 'sales'}
                onChange={(e) => setSelectedDataType(e.target.value as 'products' | 'sales')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Sales</span>
            </label>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div>
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-700"
          >
            <span>{showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options</span>
            <svg
              className={`ml-1 h-4 w-4 transform transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvancedOptions && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Pages to Fetch (leave empty for all)
              </label>
              <input
                type="number"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 10"
                min="1"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={enableDuplicateCheck}
                  onChange={(e) => setEnableDuplicateCheck(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable duplicate detection</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={updateExistingRecords}
                  onChange={(e) => setUpdateExistingRecords(e.target.checked)}
                  disabled={!enableDuplicateCheck}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">Update existing records</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={handleStartSync}
          disabled={isLoading || isCleaning}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Syncing...
            </div>
          ) : (
            `Start Robust Sync (${selectedDataType})`
          )}
        </button>

        <button
          onClick={loadStatistics}
          disabled={isLoading || isCleaning}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Refresh Stats
        </button>

        {currentStatistics?.potentialDuplicates > 0 && (
          <button
            onClick={handleCleanupDuplicates}
            disabled={isLoading || isCleaning}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCleaning ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cleaning...
              </div>
            ) : (
              'Clean Duplicates'
            )}
          </button>
        )}
      </div>

      {/* Results Display */}
      {lastResult && (
        <div className={`p-4 rounded-lg border ${lastResult.success 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`text-sm font-medium mb-2 ${lastResult.success 
            ? 'text-green-800' 
            : 'text-red-800'
          }`}>
            Sync Result
          </h4>
          <p className={`text-sm mb-3 ${lastResult.success 
            ? 'text-green-700' 
            : 'text-red-700'
          }`}>
            {formatSyncResult(lastResult)}
          </p>
          
          {lastResult.success && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <p className="font-medium text-gray-900">{lastResult.totalItemsFetched}</p>
                <p className="text-gray-500">Fetched</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900">{lastResult.newRecordsAdded}</p>
                <p className="text-gray-500">New</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900">{lastResult.duplicatesFound}</p>
                <p className="text-gray-500">Duplicates</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900">{lastResult.duplicatesUpdated}</p>
                <p className="text-gray-500">Updated</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cleanup Results */}
      {lastCleanupResult && (
        <div className={`mt-4 p-4 rounded-lg border ${lastCleanupResult.success 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`text-sm font-medium mb-2 ${lastCleanupResult.success 
            ? 'text-green-800' 
            : 'text-red-800'
          }`}>
            Cleanup Result
          </h4>
          <p className={`text-sm ${lastCleanupResult.success 
            ? 'text-green-700' 
            : 'text-red-700'
          }`}>
            {lastCleanupResult.success 
              ? `✅ Successfully removed ${lastCleanupResult.duplicatesRemoved} duplicate records`
              : `❌ Cleanup failed: ${lastCleanupResult.message}`
            }
          </p>
        </div>
      )}
    </div>
  );
}
