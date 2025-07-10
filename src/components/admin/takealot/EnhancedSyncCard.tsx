// src/components/admin/takealot/EnhancedSyncCard.tsx
// Enhanced Sync Card component with concurrent processing and Neon database support

'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface SyncResult {
  success: boolean;
  totalItemsFetched: number;
  neonRecords: number;
  firebaseRecords: number;
  strategy: string;
  processingTime: number;
  concurrentPages?: number;
  totalErrors: number;
}

interface EnhancedSyncCardProps {
  integrationId: string;
  title: string;
  description: string;
  dataType: 'products' | 'sales';
}

export default function EnhancedSyncCard({ 
  integrationId, 
  title, 
  description, 
  dataType 
}: EnhancedSyncCardProps) {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnhancedSync = async () => {
    if (!currentUser) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const idToken = await currentUser.getIdToken();
      
      const requestBody = {
        integrationId,
        dataType,
        strategy: 'Enhanced Concurrent Sync',
        maxPages: undefined, // No limit for manual sync
        concurrentOptions: {
          maxConcurrentPages: dataType === 'products' ? 10 : 6,
          batchSize: dataType === 'products' ? 250 : 150,
          retryAttempts: 3,
          delayBetweenBatches: dataType === 'products' ? 300 : 500
        }
      };

      console.log(`[EnhancedSync] Starting ${dataType} sync with options:`, requestBody.concurrentOptions);

      const response = await fetch('/api/admin/takealot/enhanced-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResult({
          success: true,
          totalItemsFetched: data.result.totalProcessed,
          neonRecords: data.result.neonRecords,
          firebaseRecords: data.result.firebaseRecords,
          strategy: data.result.strategy,
          processingTime: data.result.processingTime,
          concurrentPages: data.result.concurrentPages,
          totalErrors: data.result.errors
        });
      } else {
        throw new Error(data.error || 'Enhanced sync failed');
      }

    } catch (error: any) {
      console.error(`[EnhancedSync] Error during ${dataType} sync:`, error);
      setError(error.message || `Enhanced ${dataType} sync failed`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600">
            {description}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Enhanced
          </div>
          <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Concurrent
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
          Concurrent page processing with proxy IP rotation
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          Direct Neon database writes with Firebase fallback
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
          Intelligent retry logic and batch processing
        </div>
      </div>

      {/* Sync Button */}
      <button
        onClick={handleEnhancedSync}
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
          isLoading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing {dataType}...
          </div>
        ) : (
          `Start Enhanced ${dataType} Sync`
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-sm font-medium text-green-800 mb-2">
            ✅ Enhanced Sync Completed Successfully!
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Records Fetched:</span>
              <span className="ml-2 font-medium">{result.totalItemsFetched.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Processing Time:</span>
              <span className="ml-2 font-medium">{formatTime(result.processingTime)}</span>
            </div>
            <div>
              <span className="text-gray-600">Neon Records:</span>
              <span className="ml-2 font-medium text-blue-600">{result.neonRecords.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Concurrent Pages:</span>
              <span className="ml-2 font-medium">{result.concurrentPages || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Strategy:</span>
              <span className={`ml-2 font-medium ${
                result.strategy === 'neon-primary' ? 'text-blue-600' : 'text-orange-600'
              }`}>
                {result.strategy}
              </span>
            </div>
            {result.totalErrors > 0 && (
              <div className="col-span-2">
                <span className="text-gray-600">Errors:</span>
                <span className="ml-2 font-medium text-red-600">{result.totalErrors}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 mb-1">
            ❌ Enhanced Sync Failed
          </h4>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h5 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
          Performance Configuration
        </h5>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <span>Max Concurrent Pages:</span>
            <span className="ml-1 font-medium">
              {dataType === 'products' ? '10' : '6'}
            </span>
          </div>
          <div>
            <span>Batch Size:</span>
            <span className="ml-1 font-medium">
              {dataType === 'products' ? '250' : '150'}
            </span>
          </div>
          <div>
            <span>Retry Attempts:</span>
            <span className="ml-1 font-medium">3</span>
          </div>
          <div>
            <span>Database Strategy:</span>
            <span className="ml-1 font-medium">Neon→Firebase</span>
          </div>
        </div>
      </div>
    </div>
  );
}
