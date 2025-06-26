// src/components/LogRecorderInitializer.tsx
'use client';

import { useEffect } from 'react';
import { logRecorder } from '@/lib/logRecorder';

interface LogRecorderInitializerProps {
  children: React.ReactNode;
}

const LogRecorderInitializer: React.FC<LogRecorderInitializerProps> = ({ children }) => {
  useEffect(() => {
    // Initialize API call intercepting
    const originalFetch = window.fetch;
    
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const startTime = Date.now();
      const [resource, config] = args;
      const url = resource.toString();
      const method = config?.method || 'GET';
      
      try {
        const response = await originalFetch(...args);
        const responseTime = Date.now() - startTime;
        
        logRecorder.logApiCall(method, url, response.status, responseTime);
        
        return response;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        logRecorder.logApiCall(method, url, 0, responseTime);
        logRecorder.logCustom(
          'error',
          'error',
          'API',
          `Fetch failed: ${url}`,
          { error: error instanceof Error ? error.message : String(error), method, url },
          'fetch-error'
        );
        throw error;
      }
    };

    // Log application startup
    logRecorder.logCustom(
      'page-action',
      'success',
      'Application',
      'Application started',
      { 
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        page: window.location.pathname
      },
      'app-start'
    );

    // Cleanup function
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
};

export default LogRecorderInitializer;
