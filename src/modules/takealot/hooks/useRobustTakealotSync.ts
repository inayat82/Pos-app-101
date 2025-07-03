// src/hooks/useRobustTakealotSync.ts

import { useState, useCallback } from 'react';

interface RobustSyncOptions {
  adminId: string;
  integrationId?: string;
  dataType: 'products' | 'sales';
  maxPages?: number;
  enableDuplicateCheck?: boolean;
  updateExistingRecords?: boolean;
}

interface SyncResult {
  success: boolean;
  message: string;
  totalItemsFetched: number;
  totalItemsProcessed: number;
  duplicatesFound: number;
  duplicatesUpdated: number;
  newRecordsAdded: number;
  totalErrors: number;
  processingTime: number;
  action: 'sync' | 'cleanup';
}

interface SyncStatistics {
  totalRecords: number;
  potentialDuplicates: number;
  duplicateDetails: Array<{ id: string; field: string; value: any }>;
  lastSyncDate: string | null;
  oldestRecord: string | null;
  recordsAddedLast24h: number;
}

interface UseRobustTakealotSyncReturn {
  // State
  isLoading: boolean;
  isCleaning: boolean;
  lastResult: SyncResult | null;
  lastCleanupResult: { success: boolean; message: string; duplicatesRemoved: number } | null;
  statistics: SyncStatistics | null;
  error: string | null;

  // Actions
  startRobustSync: (options: RobustSyncOptions) => Promise<SyncResult>;
  cleanupDuplicates: (adminId: string, dataType: 'products' | 'sales') => Promise<{ success: boolean; message: string; duplicatesRemoved: number }>;
  getStatistics: (adminId: string, dataType: 'products' | 'sales') => Promise<SyncStatistics>;
  
  // Utilities
  clearError: () => void;
  clearResults: () => void;
}

export function useRobustTakealotSync(): UseRobustTakealotSyncReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastCleanupResult, setLastCleanupResult] = useState<{ success: boolean; message: string; duplicatesRemoved: number } | null>(null);
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRobustSync = useCallback(async (options: RobustSyncOptions): Promise<SyncResult> => {
    setIsLoading(true);
    setError(null);
    setLastResult(null);

    try {
      console.log('Starting robust sync with options:', options);

      const response = await fetch('/api/takealot/robust-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: options.adminId,
          integrationId: options.integrationId,
          dataType: options.dataType,
          maxPages: options.maxPages,
          enableDuplicateCheck: options.enableDuplicateCheck ?? true,
          updateExistingRecords: options.updateExistingRecords ?? true,
          action: 'sync'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result: SyncResult = await response.json();
      setLastResult(result);

      if (!result.success) {
        setError(result.message);
      }

      console.log('Robust sync completed:', result);
      return result;

    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred during sync';
      setError(errorMessage);
      console.error('Error during robust sync:', error);
      
      const failedResult: SyncResult = {
        success: false,
        message: errorMessage,
        totalItemsFetched: 0,
        totalItemsProcessed: 0,
        duplicatesFound: 0,
        duplicatesUpdated: 0,
        newRecordsAdded: 0,
        totalErrors: 1,
        processingTime: 0,
        action: 'sync'
      };
      setLastResult(failedResult);
      return failedResult;

    } finally {
      setIsLoading(false);
    }
  }, []);

  const cleanupDuplicates = useCallback(async (
    adminId: string, 
    dataType: 'products' | 'sales'
  ): Promise<{ success: boolean; message: string; duplicatesRemoved: number }> => {
    setIsCleaning(true);
    setError(null);
    setLastCleanupResult(null);

    try {
      console.log(`Starting duplicate cleanup for ${dataType} - Admin: ${adminId}`);

      const response = await fetch('/api/takealot/robust-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId,
          dataType,
          action: 'cleanup'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setLastCleanupResult(result);

      if (!result.success) {
        setError(result.message);
      }

      console.log('Duplicate cleanup completed:', result);
      return result;

    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred during cleanup';
      setError(errorMessage);
      console.error('Error during duplicate cleanup:', error);
      
      const failedResult = {
        success: false,
        message: errorMessage,
        duplicatesRemoved: 0
      };
      setLastCleanupResult(failedResult);
      return failedResult;

    } finally {
      setIsCleaning(false);
    }
  }, []);

  const getStatistics = useCallback(async (
    adminId: string, 
    dataType: 'products' | 'sales'
  ): Promise<SyncStatistics> => {
    setError(null);

    try {
      console.log(`Getting statistics for ${dataType} - Admin: ${adminId}`);

      const response = await fetch(`/api/takealot/robust-sync?adminId=${adminId}&dataType=${dataType}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      setStatistics(result.statistics);
      console.log('Statistics retrieved:', result.statistics);
      return result.statistics;

    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred while getting statistics';
      setError(errorMessage);
      console.error('Error getting statistics:', error);
      
      const emptyStats: SyncStatistics = {
        totalRecords: 0,
        potentialDuplicates: 0,
        duplicateDetails: [],
        lastSyncDate: null,
        oldestRecord: null,
        recordsAddedLast24h: 0
      };
      setStatistics(emptyStats);
      return emptyStats;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResults = useCallback(() => {
    setLastResult(null);
    setLastCleanupResult(null);
    setStatistics(null);
    setError(null);
  }, []);

  return {
    // State
    isLoading,
    isCleaning,
    lastResult,
    lastCleanupResult,
    statistics,
    error,

    // Actions
    startRobustSync,
    cleanupDuplicates,
    getStatistics,

    // Utilities
    clearError,
    clearResults
  };
}

// Utility function to format sync results for display
export function formatSyncResult(result: SyncResult): string {
  if (!result.success) {
    return `❌ Sync failed: ${result.message}`;
  }

  const parts = [];
  if (result.newRecordsAdded > 0) {
    parts.push(`✅ ${result.newRecordsAdded} new records added`);
  }
  if (result.duplicatesFound > 0) {
    parts.push(`🔄 ${result.duplicatesFound} duplicates found`);
  }
  if (result.duplicatesUpdated > 0) {
    parts.push(`📝 ${result.duplicatesUpdated} records updated`);
  }
  if (result.totalErrors > 0) {
    parts.push(`⚠️ ${result.totalErrors} errors`);
  }

  const summary = parts.length > 0 ? parts.join(', ') : '✅ Sync completed';
  const time = result.processingTime > 0 ? ` (${Math.round(result.processingTime / 1000)}s)` : '';
  
  return `${summary}${time}`;
}

// Utility function to format statistics for display
export function formatStatistics(stats: SyncStatistics): string {
  const parts = [
    `📊 ${stats.totalRecords} total records`,
  ];

  if (stats.potentialDuplicates > 0) {
    parts.push(`⚠️ ${stats.potentialDuplicates} potential duplicates`);
  }

  if (stats.recordsAddedLast24h > 0) {
    parts.push(`🆕 ${stats.recordsAddedLast24h} added in last 24h`);
  }

  if (stats.lastSyncDate) {
    const lastSync = new Date(stats.lastSyncDate);
    const timeSince = Math.round((Date.now() - lastSync.getTime()) / (1000 * 60));
    if (timeSince < 60) {
      parts.push(`🕒 Last sync: ${timeSince}m ago`);
    } else if (timeSince < 1440) {
      parts.push(`🕒 Last sync: ${Math.round(timeSince / 60)}h ago`);
    } else {
      parts.push(`🕒 Last sync: ${Math.round(timeSince / 1440)}d ago`);
    }
  }

  return parts.join(' • ');
}
