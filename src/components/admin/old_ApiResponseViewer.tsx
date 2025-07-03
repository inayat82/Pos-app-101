// src/components/admin/ApiResponseViewer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FiEye, FiClock, FiCheck, FiX, FiDatabase, FiGlobe, FiChevronDown, FiChevronRight, FiCopy, FiDownload } from 'react-icons/fi';

interface ApiCallLog {
  id: string;
  timestamp: string;
  request: {
    url: string;
    method: string;
    headers: any;
    params: any;
  };
  response: {
    status: number | string;
    statusText: string;
    headers: any;
    data: any;
    dataCount: number;
    hasNextPage: boolean;
    totalResults: number;
  };
  success: boolean;
  error?: {
    message: string;
    code: string | number;
    stack?: string;
  };
  duration: number;
  pageNumber: number;
  recordsInThisPage: number;
}

interface ProgressData {
  message: string;
  recordsProcessed: number;
  recordsSkipped: number;
  errors: number;
  currentPage: number;
  completed: boolean;
  timestamp: string;
  log: string;
  data?: any[];
  apiCallLogs?: ApiCallLog[];
  latestApiCall?: ApiCallLog;
}

interface ApiResponseViewerProps {
  progressData: ProgressData | null;
  isVisible: boolean;
  onClose: () => void;
}

export default function ApiResponseViewer({ progressData, isVisible, onClose }: ApiResponseViewerProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'api-calls' | 'logs' | 'data'>('overview');
  const [expandedApiCall, setExpandedApiCall] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<{ [key: string]: boolean }>({});

  const toggleSection = (section: string) => {
    setExpandedSection(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadAsJson = (data: any, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible || !progressData) return null;

  const apiCalls = progressData.apiCallLogs || [];
  const successfulCalls = apiCalls.filter(call => call.success);
  const failedCalls = apiCalls.filter(call => !call.success);
  const totalDuration = apiCalls.reduce((sum, call) => sum + call.duration, 0);
  const averageDuration = apiCalls.length > 0 ? totalDuration / apiCalls.length : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <FiEye className="mr-2" />
              API Response Viewer
            </h2>
            <p className="text-gray-600 mt-1">
              {progressData.completed ? 'Completed' : 'In Progress'} • 
              {progressData.recordsProcessed} records processed • 
              {apiCalls.length} API calls
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: FiGlobe },
              { id: 'api-calls', label: `API Calls (${apiCalls.length})`, icon: FiClock },
              { id: 'logs', label: 'Progress Logs', icon: FiCheck },
              { id: 'data', label: `Data (${progressData.recordsProcessed})`, icon: FiDatabase }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Overview Tab */}
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border">
                  <div className="flex items-center">
                    <FiGlobe className="text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm text-blue-600 font-medium">API Calls</p>
                      <p className="text-2xl font-bold text-blue-900">{apiCalls.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border">
                  <div className="flex items-center">
                    <FiCheck className="text-green-600 mr-2" />
                    <div>
                      <p className="text-sm text-green-600 font-medium">Successful</p>
                      <p className="text-2xl font-bold text-green-900">{successfulCalls.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border">
                  <div className="flex items-center">
                    <FiX className="text-red-600 mr-2" />
                    <div>
                      <p className="text-sm text-red-600 font-medium">Failed</p>
                      <p className="text-2xl font-bold text-red-900">{failedCalls.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border">
                  <div className="flex items-center">
                    <FiClock className="text-purple-600 mr-2" />
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Avg Response</p>
                      <p className="text-2xl font-bold text-purple-900">{Math.round(averageDuration)}ms</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Latest API Call Summary */}
              {progressData.latestApiCall && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Latest API Call</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">URL</p>
                      <p className="font-mono text-xs bg-white p-2 rounded border">
                        {progressData.latestApiCall.request.url.replace(/Key\s+[^\&]+/, 'Key [REDACTED]')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <div className="flex items-center mt-1">
                        {progressData.latestApiCall.success ? (
                          <FiCheck className="text-green-500 mr-2" />
                        ) : (
                          <FiX className="text-red-500 mr-2" />
                        )}
                        <span className={`font-medium ${
                          progressData.latestApiCall.success ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {progressData.latestApiCall.response.status} {progressData.latestApiCall.response.statusText}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          ({progressData.latestApiCall.duration}ms)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-600">Records Retrieved</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {progressData.latestApiCall.recordsInThisPage} records from page {progressData.latestApiCall.pageNumber}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* API Calls Tab */}
          {selectedTab === 'api-calls' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">API Call Details</h3>
                <button
                  onClick={() => downloadAsJson(apiCalls, `api-calls-${Date.now()}.json`)}
                  className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  <FiDownload className="mr-1" />
                  Export
                </button>
              </div>
              
              {apiCalls.map((call) => (
                <div key={call.id} className="border border-gray-200 rounded-lg">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedApiCall(expandedApiCall === call.id ? null : call.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {expandedApiCall === call.id ? <FiChevronDown /> : <FiChevronRight />}
                        {call.success ? (
                          <FiCheck className="text-green-500" />
                        ) : (
                          <FiX className="text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">
                            Page {call.pageNumber} • {call.recordsInThisPage} records
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(call.timestamp).toLocaleString()} • {call.duration}ms
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${call.success ? 'text-green-700' : 'text-red-700'}`}>
                          {call.response.status} {call.response.statusText}
                        </p>
                      </div>
                    </div>
                  </div>

                  {expandedApiCall === call.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="space-y-4">
                        {/* Request Details */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">Request</h4>
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(call.request, null, 2))}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                            >
                              <FiCopy className="mr-1" />
                              Copy
                            </button>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <p className="text-sm"><strong>URL:</strong> {call.request.url.replace(/Key\s+[^\&]+/, 'Key [REDACTED]')}</p>
                            <p className="text-sm"><strong>Method:</strong> {call.request.method}</p>
                            <div className="mt-2">
                              <strong className="text-sm">Parameters:</strong>
                              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(call.request.params, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>

                        {/* Response Details */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">Response</h4>
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(call.response.data, null, 2))}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                            >
                              <FiCopy className="mr-1" />
                              Copy Data
                            </button>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <p className="text-sm"><strong>Status:</strong> {call.response.status}</p>
                                <p className="text-sm"><strong>Records:</strong> {call.response.dataCount}</p>
                              </div>
                              <div>
                                <p className="text-sm"><strong>Duration:</strong> {call.duration}ms</p>
                                <p className="text-sm"><strong>Has Next:</strong> {call.response.hasNextPage ? 'Yes' : 'No'}</p>
                              </div>
                            </div>
                            {call.response.data && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <strong className="text-sm">Response Data Sample:</strong>
                                  <button
                                    onClick={() => toggleSection(`response-${call.id}`)}
                                    className="text-xs text-gray-600 hover:text-gray-800"
                                  >
                                    {expandedSection[`response-${call.id}`] ? 'Collapse' : 'Expand'}
                                  </button>
                                </div>
                                <pre className={`text-xs bg-gray-100 p-2 rounded overflow-x-auto ${
                                  expandedSection[`response-${call.id}`] ? 'max-h-96' : 'max-h-24'
                                }`}>
                                  {JSON.stringify(call.response.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Error Details */}
                        {call.error && (
                          <div>
                            <h4 className="font-medium text-red-700 mb-2">Error Details</h4>
                            <div className="bg-red-50 p-3 rounded border border-red-200">
                              <p className="text-sm text-red-800"><strong>Message:</strong> {call.error.message}</p>
                              <p className="text-sm text-red-800"><strong>Code:</strong> {call.error.code}</p>
                              {call.error.stack && (
                                <details className="mt-2">
                                  <summary className="text-xs text-red-600 cursor-pointer">Stack Trace</summary>
                                  <pre className="text-xs text-red-700 mt-1 bg-red-100 p-2 rounded overflow-x-auto">
                                    {call.error.stack}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Progress Logs Tab */}
          {selectedTab === 'logs' && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold mb-4">Progress Logs</h3>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                <div className="space-y-1">
                  {progressData.log.split('\n').map((line, index) => (
                    <div key={index} className="flex">
                      <span className="text-green-600 mr-2">{index + 1}.</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data Tab */}
          {selectedTab === 'data' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Fetched Data ({progressData.recordsProcessed} records)</h3>
                {progressData.data && (
                  <button
                    onClick={() => downloadAsJson(progressData.data, `fetched-data-${Date.now()}.json`)}
                    className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    <FiDownload className="mr-1" />
                    Export Data
                  </button>
                )}
              </div>
              
              {progressData.data && progressData.data.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">
                      Showing first 3 records of {progressData.data.length} total records
                    </p>
                  </div>
                  {progressData.data.slice(0, 3).map((record, index) => (
                    <div key={index} className="border border-gray-200 rounded">
                      <div className="p-3 bg-gray-50 border-b">
                        <h4 className="font-medium">Record {index + 1}</h4>
                      </div>
                      <div className="p-3">
                        <pre className="text-xs bg-white border rounded p-2 overflow-x-auto max-h-48">
                          {JSON.stringify(record, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FiDatabase className="mx-auto text-4xl mb-2" />
                  <p>No data available yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
