// src/components/admin/DetailedLogViewer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FiClock, FiCheck, FiX, FiDatabase, FiRefreshCw, FiDownload, FiEye } from 'react-icons/fi';

interface LogEntry {
  id: string;
  integrationId: string;
  logId: string;
  phase: string;
  message: string;
  timestamp: string;
  createdAt: string;
  recordCount?: number;
  totalProcessed?: number;
  saveDuration?: number;
  pageNumber?: number;
  error?: string;
  options?: any;
}

interface DetailedLogViewerProps {
  integrationId: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function DetailedLogViewer({ integrationId, isVisible, onClose }: DetailedLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<string>('all');

  const fetchLogs = async () => {
    if (!integrationId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/takealot/fetch-logs?integrationId=${integrationId}&limit=100`);
      const data = await response.json();
      
      if (response.ok) {
        setLogs(data.logs || []);
      } else {
        setError(data.error || 'Failed to fetch logs');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && integrationId) {
      fetchLogs();
    }
  }, [isVisible, integrationId]);

  const filteredLogs = logs.filter(log => 
    filterPhase === 'all' || log.phase === filterPhase
  );

  const phases = ['all', ...Array.from(new Set(logs.map(log => log.phase)))];

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'initialization': return <FiRefreshCw className="text-blue-500" />;
      case 'batch_save': return <FiDatabase className="text-green-500" />;
      case 'batch_save_error': return <FiX className="text-red-500" />;
      case 'completion': return <FiCheck className="text-green-500" />;
      default: return <FiClock className="text-gray-500" />;
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'initialization': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'batch_save': return 'bg-green-50 text-green-700 border-green-200';
      case 'batch_save_error': return 'bg-red-50 text-red-700 border-red-200';
      case 'completion': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const downloadLogs = () => {
    const json = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `takealot-logs-${integrationId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <FiEye className="mr-2" />
                Detailed Fetch Logs
              </h2>
              <p className="text-gray-600 mt-1">
                Integration: {integrationId} • {filteredLogs.length} entries
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={downloadLogs}
                className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <FiDownload className="mr-1" />
                Export
              </button>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              >
                <FiRefreshCw className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Phase
            </label>
            <select
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              className="block w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {phases.map(phase => (
                <option key={phase} value={phase}>
                  {phase === 'all' ? 'All Phases' : phase.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Logs */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <FiRefreshCw className="animate-spin w-8 h-8 mx-auto text-blue-500 mb-2" />
                <p className="text-gray-500">Loading logs...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <FiX className="w-8 h-8 mx-auto text-red-500 mb-2" />
                <p className="text-red-600">{error}</p>
                <button
                  onClick={fetchLogs}
                  className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Retry
                </button>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <FiClock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No logs found</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className={`border rounded-lg p-4 ${getPhaseColor(log.phase)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getPhaseIcon(log.phase)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-sm">
                            {log.phase.replace('_', ' ').toUpperCase()}
                          </span>
                          {log.pageNumber && (
                            <span className="px-2 py-1 bg-white bg-opacity-50 text-xs rounded">
                              Page {log.pageNumber}
                            </span>
                          )}
                          {log.recordCount && (
                            <span className="px-2 py-1 bg-white bg-opacity-50 text-xs rounded">
                              {log.recordCount} records
                            </span>
                          )}
                        </div>
                        <p className="text-sm mb-2">{log.message}</p>
                        <div className="flex items-center space-x-4 text-xs opacity-75">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          {log.saveDuration && (
                            <span>Save Duration: {log.saveDuration}ms</span>
                          )}
                          {log.totalProcessed && (
                            <span>Total Processed: {log.totalProcessed}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {log.error && (
                    <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded">
                      <p className="text-sm text-red-700">
                        <strong>Error:</strong> {log.error}
                      </p>
                    </div>
                  )}
                  {log.options && (
                    <details className="mt-3">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                        View Options
                      </summary>
                      <pre className="text-xs bg-white bg-opacity-50 p-2 mt-2 rounded overflow-auto">
                        {JSON.stringify(log.options, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
