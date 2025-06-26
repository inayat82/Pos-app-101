'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { UserRole } from '@/types/user';
import { useLogRecorder } from '@/hooks/useLogRecorder';
import { LogEntry } from '@/lib/logRecorder';
import { 
  DocumentTextIcon, 
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  EyeIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  PauseIcon,
  ComputerDesktopIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  UserIcon as UserActionIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';

const LogsPage: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const { setPageTitle } = usePageTitle();
  const { 
    logs, 
    isRecording, 
    clearLogs, 
    exportLogs, 
    toggleRecording 
  } = useLogRecorder();
  
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | '1h' | '6h' | '24h'>('all');

  // Set page title (without logging to avoid noise)
  useEffect(() => {
    setPageTitle('System Logs');
    // Don't log page visits to logs page to avoid noise
  }, [setPageTitle]);

  // Get unique values for filters
  const uniqueCategories = useMemo(() => {
    const categories = ['all', ...Array.from(new Set(logs.map(log => log.category)))];
    return categories.sort();
  }, [logs]);

  const uniquePages = useMemo(() => {
    const pages = ['all', ...Array.from(new Set(logs.map(log => log.page || 'unknown').filter(Boolean)))];
    return pages.sort();
  }, [logs]);

  const uniqueSources = useMemo(() => {
    const sources = ['all', ...Array.from(new Set(logs.map(log => log.source || 'unknown').filter(Boolean)))];
    return sources.sort();
  }, [logs]);

  const types = ['all', 'log', 'error', 'warn', 'info', 'debug', 'page-action', 'api-call'];

  // Filter logs based on selected filters and search term
  useEffect(() => {
    let filtered = logs;

    // Time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : 24;
      const cutoff = new Date(now.getTime() - (hours * 60 * 60 * 1000)).toISOString();
      filtered = filtered.filter(log => log.timestamp >= cutoff);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(log => log.category === selectedCategory);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(log => log.type === selectedType);
    }

    if (selectedPage !== 'all') {
      filtered = filtered.filter(log => log.page === selectedPage);
    }

    if (selectedSource !== 'all') {
      filtered = filtered.filter(log => log.source === selectedSource);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(search) ||
        log.category.toLowerCase().includes(search) ||
        (log.source && log.source.toLowerCase().includes(search)) ||
        (log.page && log.page.toLowerCase().includes(search))
      );
    }

    setFilteredLogs(filtered);
  }, [logs, selectedCategory, selectedType, selectedPage, selectedSource, searchTerm, timeRange]);

  // Get icon and color for log type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warn':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'log':
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'debug':
        return <CodeBracketIcon className="h-5 w-5 text-purple-500" />;
      case 'page-action':
        return <ComputerDesktopIcon className="h-5 w-5 text-green-500" />;
      case 'api-call':
        return <GlobeAltIcon className="h-5 w-5 text-indigo-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'console':
        return <CodeBracketIcon className="h-4 w-4" />;
      case 'api':
        return <GlobeAltIcon className="h-4 w-4" />;
      case 'page activity':
      case 'navigation':
        return <ComputerDesktopIcon className="h-4 w-4" />;
      case 'user action':
        return <UserActionIcon className="h-4 w-4" />;
      case 'system':
      case 'application':
        return <CpuChipIcon className="h-4 w-4" />;
      default:
        return <InformationCircleIcon className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string, level?: string) => {
    if (level === 'error') return 'bg-red-50 border-red-200';
    if (level === 'warning') return 'bg-yellow-50 border-yellow-200';
    
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200';
      case 'page-action':
        return 'bg-green-50 border-green-200';
      case 'api-call':
        return 'bg-indigo-50 border-indigo-200';
      case 'debug':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  // Handle log detail view
  const viewLogDetails = (log: LogEntry) => {
    setSelectedLog(log);
    setIsModalOpen(true);
    // Don't log this action to avoid noise in logs page
  };

  // Handle export
  const handleExport = () => {
    const data = exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Don't log export action to avoid noise in logs page
  };

  // Handle clear logs
  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      clearLogs();
      // Don't log clear action to avoid noise in logs page
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser || userProfile?.role !== UserRole.Admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be an admin to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <DocumentTextIcon className="h-8 w-8 text-gray-700 mr-3" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">System Logs</h1>
              <p className="text-sm text-gray-600 mt-1">
                Real-time monitoring of console logs, errors, and system activities
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Recording Status */}
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {isRecording ? 'Recording' : 'Paused'}
              </span>
            </div>
            
            {/* Control Buttons */}
            <button
              onClick={toggleRecording}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isRecording 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isRecording ? (
                <>
                  <PauseIcon className="h-4 w-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Resume
                </>
              )}
            </button>

            <button
              onClick={handleExport}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Export
            </button>

            <button
              onClick={handleClearLogs}
              className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
          <div className="text-sm text-gray-600">Total Logs</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-red-600">
            {logs.filter(log => log.level === 'error').length}
          </div>
          <div className="text-sm text-gray-600">Errors</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-yellow-600">
            {logs.filter(log => log.level === 'warning').length}
          </div>
          <div className="text-sm text-gray-600">Warnings</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {logs.filter(log => log.type === 'api-call').length}
          </div>
          <div className="text-sm text-gray-600">API Calls</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {logs.filter(log => log.type === 'page-action').length}
          </div>
          <div className="text-sm text-gray-600">Page Actions</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'all' | '1h' | '6h' | '24h')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Time</option>
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {uniqueCategories.map((category: string) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {types.map((type: string) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Page Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Page</label>
            <select
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {uniquePages.map((page: string) => (
                <option key={page} value={page}>
                  {page === 'all' ? 'All Pages' : page}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {uniqueSources.map((source: string) => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All Sources' : source}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{filteredLogs.length}</span> of{' '}
            <span className="font-medium">{logs.length}</span> logs
          </div>
          <div className="text-xs text-gray-500">
            Last updated: {logs.length > 0 ? getRelativeTime(logs[0].timestamp) : 'Never'}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No logs found</h3>
            <p className="text-gray-600">
              {logs.length === 0 
                ? 'No logs available. Interact with the application to generate logs.'
                : 'Try adjusting your search criteria.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Page
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className={`hover:bg-gray-50 ${getTypeColor(log.type, log.level)} border-l-4`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {getTypeIcon(log.type)}
                        <span className="ml-2 text-sm font-medium capitalize">{log.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs text-gray-600">
                        <div>{getRelativeTime(log.timestamp)}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {getCategoryIcon(log.category)}
                        <span className="ml-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          {log.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="text-sm text-gray-900 truncate">
                        {log.message}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                      {log.page ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {log.page.split('/').pop() || log.page}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                      {log.source ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {log.source}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => viewLogDetails(log)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {isModalOpen && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Log Details</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <div className="flex items-center">
                      {getTypeIcon(selectedLog.type)}
                      <span className="ml-2 capitalize">{selectedLog.type}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedLog.level === 'error' ? 'bg-red-100 text-red-800' :
                      selectedLog.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      selectedLog.level === 'success' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedLog.level}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
                    <p className="text-sm text-gray-900">{formatTimestamp(selectedLog.timestamp)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relative Time</label>
                    <p className="text-sm text-gray-900">{getRelativeTime(selectedLog.timestamp)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <div className="flex items-center">
                      {getCategoryIcon(selectedLog.category)}
                      <span className="ml-1">{selectedLog.category}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <p className="text-sm text-gray-900">{selectedLog.source || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Page</label>
                    <p className="text-sm text-gray-900">{selectedLog.page || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Log ID</label>
                    <p className="text-xs text-gray-600 font-mono">{selectedLog.id}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                    {selectedLog.message}
                  </p>
                </div>

                {selectedLog.stackTrace && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stack Trace</label>
                    <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {selectedLog.stackTrace}
                    </pre>
                  </div>
                )}

                {selectedLog.details && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                    <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded-lg overflow-x-auto">
                      {typeof selectedLog.details === 'string' 
                        ? selectedLog.details 
                        : JSON.stringify(selectedLog.details, null, 2)
                      }
                    </pre>
                  </div>
                )}

                {selectedLog.userAgent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Agent</label>
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded break-all">
                      {selectedLog.userAgent}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    const logData = JSON.stringify(selectedLog, null, 2);
                    navigator.clipboard.writeText(logData);
                    alert('Log data copied to clipboard');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsPage;
