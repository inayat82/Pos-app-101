// src/components/admin/ApiCallLogTable.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiEye, FiCheck, FiX, FiClock, FiRefreshCw, FiDatabase, 
  FiBarChart, FiShoppingCart, FiActivity, FiChevronDown, FiChevronRight 
} from 'react-icons/fi';

interface ApiCallLogEntry {
  id: string;
  timestamp: string;
  strategy: string;
  status: 'running' | 'completed' | 'failed';
  recordsFetched: number;
  recordsSaved: number;
  pagesProcessed: number;
  totalPages?: number;
  apiCallsCount: number;
  operationType: string;
  operationDuration: number;
  requestedLimit?: number;
  pageSize: number;
  error?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  isSuccess: boolean;
  apiCallLogs?: Array<{
    id: string;
    url: string;
    status: number;
    duration: number;
    recordsReturned: number;
    timestamp: string;
    response?: any;
  }>;
}

interface ApiCallLogTableProps {
  integrationId: string;
  className?: string;
}

export default function ApiCallLogTable({ integrationId, className = '' }: ApiCallLogTableProps) {
  const [logs, setLogs] = useState<ApiCallLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ApiCallLogEntry | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const fetchLogs = async () => {
    if (!integrationId) {
      console.warn('ApiCallLogTable: integrationId is missing, cannot fetch logs.');
      setLogs([]); // Clear logs if integrationId is missing
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log(`ApiCallLogTable: Fetching logs for integrationId: ${integrationId}`);
    try {
      // Use the centralized logging API instead of direct Firestore query
      const response = await fetch(`/api/admin/takealot/fetch-logs?integrationId=${integrationId}&limit=50`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('ApiCallLogTable: Raw API response:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const fetchedLogs: ApiCallLogEntry[] = [];
      
      if (!data.logs || data.logs.length === 0) {
        console.log(`ApiCallLogTable: No logs found for integrationId: ${integrationId}`);
        setLogs([]);
        return;
      }

      // Convert API response to our log entry format
      data.logs.forEach((logData: any) => {
        console.log('ApiCallLogTable: Processing log data:', logData);
        
        const logEntry: ApiCallLogEntry = {
          id: logData.id,
          timestamp: logData.createdAt || logData.timestamp || new Date().toISOString(),
          // Create strategy description from cronJobName or operation
          strategy: logData.cronJobName ? 
            logData.cronJobName.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) :
            logData.operation || 'Manual Sync',
          status: logData.status === 'success' ? 'completed' : 
                 logData.status === 'failure' ? 'failed' : 
                 logData.status || 'running',
          recordsFetched: logData.recordsFetched || logData.totalReads || 0,
          recordsSaved: logData.recordsSaved || logData.totalWrites || 0,
          pagesProcessed: logData.pagesFetched || logData.totalPages || 0,
          totalPages: logData.totalPages || undefined,
          apiCallsCount: logData.apiCallsCount || logData.totalApiCalls || 0,
          operationType: logData.type || logData.operationType || 'unknown',
          operationDuration: logData.duration || 0,
          requestedLimit: logData.requestedLimit,
          pageSize: logData.pageSize || 100,
          error: logData.status === 'failure' ? (logData.error || 'Operation failed') : undefined,
          startTime: logData.startTime || logData.createdAt || new Date().toISOString(),
          endTime: logData.endTime || logData.timestamp || new Date().toISOString(),
          duration: logData.duration || 0,
          isSuccess: logData.status === 'success' || logData.isSuccess || false,
          apiCallLogs: logData.apiCallLogs || []
        };
        
        fetchedLogs.push(logEntry);
      });
      
      setLogs(fetchedLogs);
      console.log('ApiCallLogTable: Successfully fetched and processed logs:', fetchedLogs);
    } catch (error) {
      console.error('ApiCallLogTable: Error fetching or processing logs:', error);
      // Optionally, set an error state here to display to the user
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('ApiCallLogTable: useEffect triggered, integrationId:', integrationId);
    if (integrationId) {
      fetchLogs();
    } else {
      console.warn('ApiCallLogTable: useEffect - integrationId is missing on mount/update.');
      setLogs([]); // Ensure logs are cleared if integrationId becomes undefined
    }
  }, [integrationId]); // Removed fetchLogs from dependency array to avoid potential loops if fetchLogs itself changes

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheck className="text-green-500" />;
      case 'running':
        return <FiRefreshCw className="text-blue-500 animate-spin" />;
      case 'failed':
        return <FiX className="text-red-500" />;
      default:
        return <FiClock className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStrategyIcon = (strategy: string) => {
    if (strategy.toLowerCase().includes('sales')) {
      return <FiBarChart className="text-blue-500" />;
    } else if (strategy.toLowerCase().includes('product')) {
      return <FiShoppingCart className="text-purple-500" />;
    }
    return <FiActivity className="text-gray-500" />;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const openDetailModal = (log: ApiCallLogEntry) => {
    setSelectedLog(log);
    setDetailModalVisible(true);
  };

  const DetailModal = () => {
    if (!selectedLog || !detailModalVisible) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  {getStrategyIcon(selectedLog.strategy)}
                  <span className="ml-2">{selectedLog.strategy} - API Call Details</span>
                </h2>
                <p className="text-gray-600 mt-1">
                  {selectedLog.apiCallsCount} API calls • {selectedLog.recordsFetched} records fetched
                </p>
              </div>
              <button
                onClick={() => setDetailModalVisible(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Records</div>
                  <div className="text-lg font-bold text-blue-900">
                    {selectedLog.recordsFetched} fetched / {selectedLog.recordsSaved} saved
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">Pages</div>
                  <div className="text-lg font-bold text-purple-900">
                    {selectedLog.pagesProcessed} {selectedLog.totalPages ? `/ ${selectedLog.totalPages}` : ''}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Duration</div>
                  <div className="text-lg font-bold text-green-900">
                    {selectedLog.duration ? formatDuration(selectedLog.duration) : 'In progress'}
                  </div>
                </div>
              </div>              {/* API Calls */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Calls ({selectedLog.apiCallsCount})</h3>
                <div className="space-y-3">
                  {selectedLog.apiCallLogs && selectedLog.apiCallLogs.length > 0 ? (
                    selectedLog.apiCallLogs.map((apiCall: any, index: number) => (
                      <div key={apiCall.id || index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm font-medium">
                              Call #{index + 1}
                            </span>
                            <span className={`px-2 py-1 rounded text-sm font-medium ${
                              apiCall.status === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {apiCall.status || 'Unknown'}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDuration(apiCall.duration || 0)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {apiCall.recordsReturned || apiCall.recordsInThisPage || 0} records
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">URL:</div>
                          <div className="text-sm font-mono bg-gray-50 p-2 rounded border break-all">
                            {(apiCall.url || apiCall.request?.url || 'N/A').replace(/Key\s+[^\&]+/, 'Key [REDACTED]')}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Response (First 20 lines):</div>
                          <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-48">
                            {apiCall.response ? 
                              JSON.stringify(apiCall.response, null, 2).split('\n').slice(0, 20).join('\n') + 
                              (JSON.stringify(apiCall.response, null, 2).split('\n').length > 20 ? '\n... (truncated)' : '') :
                              'No response data available'
                            }
                          </pre>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No detailed API call logs available for this operation.
                    </div>
                  )}
                </div>
              </div>

              {/* Error Details */}
              {selectedLog.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Details</h3>
                  <p className="text-red-700">{selectedLog.error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">API Call Log System</h3>          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
          >
            <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Strategy
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API Calls
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStrategyIcon(log.strategy)}
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-900">{log.strategy}</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(log.timestamp)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(log.status)}
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded border ${getStatusColor(log.status)}`}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div>Fetched: <span className="font-medium">{log.recordsFetched}</span></div>
                      <div>Saved: <span className="font-medium text-green-600">{log.recordsSaved}</span></div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.pagesProcessed} {log.totalPages ? `/ ${log.totalPages}` : ''}
                    </div>
                    {log.totalPages && log.status === 'running' && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min((log.pagesProcessed / log.totalPages) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-medium">{log.apiCallsCount}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.duration ? formatDuration(log.duration) : (
                        <span className="text-blue-600">In progress...</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openDetailModal(log)}
                      className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                    >
                      <FiEye className="mr-1" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && (
          <div className="text-center py-8">
            <FiDatabase className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500">No API calls logged yet</p>
            <p className="text-sm text-gray-400">Start fetching data to see logs appear here</p>
          </div>
        )}
      </div>

      <DetailModal />
    </>
  );
}
