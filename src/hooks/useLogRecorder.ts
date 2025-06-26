// src/hooks/useLogRecorder.ts
import { useState, useEffect, useCallback } from 'react';
import { logRecorder, LogEntry } from '@/lib/logRecorder';

export const useLogRecorder = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRecording, setIsRecording] = useState(true);

  useEffect(() => {
    // Subscribe to log updates
    const unsubscribe = logRecorder.subscribe((newLogs) => {
      if (isRecording) {
        setLogs(newLogs);
      }
    });

    // Get initial logs
    setLogs(logRecorder.getLogs());

    return unsubscribe;
  }, [isRecording]);

  const clearLogs = useCallback(() => {
    logRecorder.clearLogs();
  }, []);

  const exportLogs = useCallback(() => {
    return logRecorder.exportLogs();
  }, []);

  const logUserAction = useCallback((action: string, details?: any) => {
    logRecorder.logUserAction(action, details);
  }, []);

  const logApiCall = useCallback((method: string, url: string, status?: number, responseTime?: number) => {
    logRecorder.logApiCall(method, url, status, responseTime);
  }, []);

  const logCustom = useCallback((
    type: LogEntry['type'],
    level: LogEntry['level'],
    category: string,
    message: string,
    details?: any,
    source?: string
  ) => {
    logRecorder.logCustom(type, level, category, message, details, source);
  }, []);

  const getLogsByPage = useCallback((page: string) => {
    return logRecorder.getLogsByPage(page);
  }, []);

  const getLogsByCategory = useCallback((category: string) => {
    return logRecorder.getLogsByCategory(category);
  }, []);

  const getLogsByTimeRange = useCallback((startTime: string, endTime: string) => {
    return logRecorder.getLogsByTimeRange(startTime, endTime);
  }, []);

  const toggleRecording = useCallback(() => {
    setIsRecording(!isRecording);
  }, [isRecording]);

  return {
    logs,
    isRecording,
    clearLogs,
    exportLogs,
    logUserAction,
    logApiCall,
    logCustom,
    getLogsByPage,
    getLogsByCategory,
    getLogsByTimeRange,
    toggleRecording,
  };
};
