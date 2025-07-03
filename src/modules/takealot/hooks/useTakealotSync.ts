// src/modules/takealot/hooks/useTakealotSync.ts
// Hook for managing Takealot sync operations

import { useState, useCallback } from 'react';
import { fetchAndSaveTakealotData, FetchProgressState } from '../services/sync.service';

interface UseTakealotSyncOptions {
  onProgress?: (progress: Partial<FetchProgressState>) => void;
  onComplete?: (result: { success: boolean; message: string; totalItemsFetched: number; totalErrors: number }) => void;
  onError?: (error: string) => void;
}

export const useTakealotSync = (options: UseTakealotSyncOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<Partial<FetchProgressState>>({});
  const [result, setResult] = useState<{ success: boolean; message: string; totalItemsFetched: number; totalErrors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncData = useCallback(async (
    endpoint: string,
    apiKey: string,
    adminId: string,
    dataType: 'products' | 'sales',
    maxPages?: number
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);
      setProgress({});

      const progressCallback = (progressData: Partial<FetchProgressState>) => {
        setProgress(progressData);
        options.onProgress?.(progressData);
      };

      const syncResult = await fetchAndSaveTakealotData(
        endpoint,
        apiKey,
        adminId,
        dataType,
        maxPages,
        progressCallback
      );

      setResult(syncResult);
      options.onComplete?.(syncResult);

      return syncResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
      options.onError?.(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const resetState = useCallback(() => {
    setIsLoading(false);
    setProgress({});
    setResult(null);
    setError(null);
  }, []);

  return {
    isLoading,
    progress,
    result,
    error,
    syncData,
    resetState
  };
};
