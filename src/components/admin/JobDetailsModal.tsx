// src/components/admin/JobDetailsModal.tsx
import React from 'react';
import { FiX, FiCopy, FiExternalLink, FiSave } from 'react-icons/fi';
import type { JobLogUI } from '@/types/job';

interface JobDetailsModalProps {
  job: JobLogUI | null;
  isOpen: boolean;
  onClose: () => void;
}

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ job, isOpen, onClose }) => {
  if (!isOpen || !job) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const saveCompleteJobSummary = () => {
    const fullSummary = `
=== COMPLETE JOB SUMMARY ===
Job ID: ${job.jobId}
Data Type: ${job.dataType}
Status: ${job.status}
Message: ${job.statusMessage || job.overallMessage || 'No message'}

=== PERFORMANCE METRICS ===
Total Requests Sent: ${job.totalRequestsSent || 1}
Records Fetched: ${job.totalRecordsFetched || job.successfulItems || 0}
Records Saved: ${job.totalRecordsSaved || 0}
Duration: ${job.duration ? Math.round(job.duration / 1000) + 's' : 'N/A'}
Average Response Time: ${job.averageResponseTime ? Math.round(job.averageResponseTime) + 'ms' : 'N/A'}

=== API INFORMATION ===
Endpoint: ${job.apiEndpoint || 'N/A'}
Request Headers: ${job.requestHeaders ? JSON.stringify(job.requestHeaders, null, 2) : 'N/A'}

=== API RESPONSE (First 20 lines) ===
${job.lastApiResponse || 'No response data available'}

=== ERROR DETAILS ===
${job.errorDetails || 'No errors'}

=== TIMESTAMPS ===
Started: ${job.startTime?.toDate ? job.startTime.toDate().toLocaleString() : 'Unknown'}
Completed: ${job.endTime?.toDate ? job.endTime.toDate().toLocaleString() : 'In progress'}
    `;
    navigator.clipboard.writeText(fullSummary);
    alert('Complete job summary copied to clipboard!');
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Job Details - {job.dataType.toUpperCase()} Fetch
              </h3>
              <p className="text-sm text-gray-500">Job ID: {job.jobId}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={saveCompleteJobSummary}
                className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                title="Save complete job summary to clipboard"
              >
                <FiSave className="w-4 h-4 inline mr-1" />
                Save Summary
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Executive Summary Card */}
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
            <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <span className={`w-3 h-3 rounded-full mr-3 ${
                job.status === 'success' || job.status === 'completed' ? 'bg-green-500' :
                job.status === 'failed' || job.status === 'error' ? 'bg-red-500' :
                job.status === 'running' ? 'bg-yellow-500' : 'bg-gray-500'
              }`}></span>
              Executive Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{job.totalRecordsFetched || job.successfulItems || 0}</div>
                <div className="text-sm text-gray-600">Records Fetched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{job.totalRecordsSaved || 0}</div>
                <div className="text-sm text-gray-600">Records Saved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{job.totalRequestsSent || 1}</div>
                <div className="text-sm text-gray-600">API Requests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{formatDuration(job.duration)}</div>
                <div className="text-sm text-gray-600">Duration</div>
              </div>
            </div>

            {/* Status Banner */}
            <div className={`mt-4 p-3 rounded-lg ${
              job.status === 'success' || job.status === 'completed' ? 'bg-green-100 border border-green-300' :
              job.status === 'failed' || job.status === 'error' ? 'bg-red-100 border border-red-300' :
              job.status === 'running' ? 'bg-yellow-100 border border-yellow-300' : 'bg-gray-100 border border-gray-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${
                  job.status === 'success' || job.status === 'completed' ? 'text-green-800' :
                  job.status === 'failed' || job.status === 'error' ? 'text-red-800' :
                  job.status === 'running' ? 'text-yellow-800' : 'text-gray-800'
                }`}>
                  Status: {job.status?.toUpperCase() || 'UNKNOWN'}
                </span>
                <span className="text-sm text-gray-600">
                  {job.startTime?.toDate ? job.startTime.toDate().toLocaleString() : 'Unknown time'}
                </span>
              </div>
              {(job.overallMessage || job.statusMessage) && (
                <div className="mt-2 text-sm text-gray-700">
                  {job.overallMessage || job.statusMessage}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Technical Details */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <FiExternalLink className="w-4 h-4 mr-2" />
                  Technical Information
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Job ID:</span>
                    <span className="text-gray-900 font-mono text-xs">{job.jobId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Data Type:</span>
                    <span className="text-gray-900 capitalize">{job.dataType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Strategy:</span>
                    <span className="text-gray-900">{job.strategyDescription || 'Manual Fetch'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">User ID:</span>
                    <span className="text-gray-900 font-mono text-xs">{job.userId || 'N/A'}</span>
                  </div>
                  {job.currentPage && job.totalPages && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Pagination:</span>
                      <span className="text-gray-900">Page {job.currentPage} of {job.totalPages}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3">📊 Performance Metrics</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Records Fetched:</span>
                    <div className="text-2xl font-bold text-blue-600">{job.totalRecordsFetched || job.successfulItems || 0}</div>
                  </div>
                  <div>
                    <span className="font-medium text-green-700">Records Saved:</span>
                    <div className="text-2xl font-bold text-green-600">{job.totalRecordsSaved || 0}</div>
                  </div>
                  <div>
                    <span className="font-medium text-purple-700">API Requests:</span>
                    <div className="text-xl font-bold text-purple-600">{job.totalRequestsSent || 1}</div>
                  </div>
                  <div>
                    <span className="font-medium text-orange-700">Error Count:</span>
                    <div className="text-xl font-bold text-orange-600">{job.errorItems || 0}</div>
                  </div>
                  {job.averageResponseTime && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">Avg Response Time:</span>
                      <div className="text-lg font-bold text-gray-600">{Math.round(job.averageResponseTime)}ms</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timing Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">⏰ Timing Information</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Started:</span>
                    <div className="text-gray-900">{job.startTime?.toDate ? job.startTime.toDate().toLocaleString() : 'Unknown'}</div>
                  </div>
                  {job.endTime && (
                    <div>
                      <span className="font-medium text-gray-600">Completed:</span>
                      <div className="text-gray-900">{job.endTime.toDate ? job.endTime.toDate().toLocaleString() : 'Unknown'}</div>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-600">Duration:</span>
                    <div className="text-gray-900 font-semibold">{formatDuration(job.duration)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* API & Network Details */}
            <div className="space-y-4">
              {/* API Endpoint */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <h4 className="font-semibold text-indigo-900 mb-3">🌐 API Information</h4>
                {job.apiEndpoint ? (
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-indigo-700 block mb-1">Endpoint:</span>
                      <div className="flex items-center space-x-2">
                        <code className="bg-white px-3 py-2 rounded border text-sm flex-1 break-all">
                          {job.apiEndpoint}
                        </code>
                        <button
                          onClick={() => copyToClipboard(job.apiEndpoint!)}
                          className="p-2 text-indigo-600 hover:text-indigo-800 bg-white border rounded"
                          title="Copy endpoint"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {job.totalRequestsSent && job.totalRequestsSent > 0 && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-indigo-700">Total Requests:</span>
                          <div className="text-lg font-bold text-indigo-600">{job.totalRequestsSent}</div>
                        </div>
                        {job.averageResponseTime && (
                          <div>
                            <span className="font-medium text-indigo-700">Avg Response:</span>
                            <div className="text-lg font-bold text-indigo-600">{Math.round(job.averageResponseTime)}ms</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No API endpoint information available</div>
                )}
              </div>

              {/* Request Headers */}
              {job.requestHeaders && Object.keys(job.requestHeaders).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">📋 Request Headers</h4>
                  <div className="space-y-2">
                    {Object.entries(job.requestHeaders).map(([key, value]) => (
                      <div key={key} className="flex items-start space-x-2 text-sm">
                        <span className="font-medium text-gray-600 min-w-0 flex-shrink-0">{key}:</span>
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <code className="bg-white px-2 py-1 rounded border text-xs flex-1 truncate">
                            {value.length > 100 ? `${value.substring(0, 100)}...` : value}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`${key}: ${value}`)}
                            className="p-1 text-gray-500 hover:text-gray-700 flex-shrink-0"
                            title="Copy header"
                          >
                            <FiCopy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Stats Card */}
              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-gray-900 mb-3">🎯 Quick Stats</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {job.totalRecordsSaved && job.totalRecordsFetched ? 
                        Math.round((job.totalRecordsSaved / (job.totalRecordsFetched || 1)) * 100) : 0}%
                    </div>
                    <div className="text-gray-600">Save Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {job.totalRequestsSent && job.totalRecordsFetched ? 
                        Math.round((job.totalRecordsFetched || 0) / (job.totalRequestsSent || 1)) : 0}
                    </div>
                    <div className="text-gray-600">Records per Request</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {job.duration && job.totalRecordsFetched ? 
                        Math.round((job.totalRecordsFetched || 0) / ((job.duration || 1) / 1000)) : 0}
                    </div>
                    <div className="text-gray-600">Records per Second</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {job.errorItems || 0 > 0 ? 
                        Math.round(((job.errorItems || 0) / ((job.totalRecordsFetched || 0) + (job.errorItems || 0))) * 100) : 0}%
                    </div>
                    <div className="text-gray-600">Error Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Messages & Responses */}
          <div className="mt-8 space-y-6">
            {/* Current Status Message */}
            {job.statusMessage && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-blue-900">💬 Current Status Message</h4>
                  <button
                    onClick={() => copyToClipboard(job.statusMessage!)}
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Copy message"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-blue-800 bg-white p-3 rounded border">{job.statusMessage}</p>
              </div>
            )}

            {/* Overall Summary Message */}
            {job.overallMessage && job.overallMessage !== job.statusMessage && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-900">📊 Overall Summary</h4>
                  <button
                    onClick={() => copyToClipboard(job.overallMessage!)}
                    className="p-1 text-green-600 hover:text-green-800"
                    title="Copy summary"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-green-800 bg-white p-3 rounded border">{job.overallMessage}</p>
              </div>
            )}

            {/* Error Details */}
            {job.errorDetails && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-red-900">❌ Error Details</h4>
                  <button
                    onClick={() => copyToClipboard(job.errorDetails!)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Copy error details"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="text-xs text-red-700 bg-white p-3 rounded border overflow-auto max-h-40 whitespace-pre-wrap">
                  {job.errorDetails}
                </pre>
              </div>
            )}

            {/* Enhanced API Response */}
            {job.lastApiResponse && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    🔗 API Response (First 20 lines)
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                      Available
                    </span>
                  </h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(job.lastApiResponse!)}
                      className="p-1 text-gray-600 hover:text-gray-800"
                      title="Copy API response"
                    >
                      <FiCopy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-2 mb-3">
                  <div className="text-sm text-green-800">
                    <strong>Quick Info:</strong> {job.totalRequestsSent || 1} requests sent to {job.apiEndpoint?.split('/').pop() || 'API'}, 
                    {job.totalRecordsFetched || 0} records fetched in {job.duration ? Math.round(job.duration / 1000) + 's' : 'unknown time'}
                  </div>
                </div>
                <pre className="text-xs text-gray-700 bg-white p-3 rounded border overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                  {job.lastApiResponse}
                </pre>
              </div>
            )}

            {/* Complete Job Information for Debugging */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">🔧 Complete Job Data (Debug Info)</h4>
                <button
                  onClick={() => {
                    const jobData = {
                      jobId: job.jobId,
                      dataType: job.dataType,
                      status: job.status,
                      strategy: job.strategyDescription,
                      apiEndpoint: job.apiEndpoint,
                      totalRequestsSent: job.totalRequestsSent,
                      totalRecordsFetched: job.totalRecordsFetched,
                      totalRecordsSaved: job.totalRecordsSaved,
                      duration: job.duration,
                      startTime: job.startTime?.toDate?.()?.toISOString(),
                      endTime: job.endTime?.toDate?.()?.toISOString(),
                      requestHeaders: job.requestHeaders,
                      statusMessage: job.statusMessage,
                      overallMessage: job.overallMessage,
                      errorDetails: job.errorDetails,
                      lastApiResponse: job.lastApiResponse
                    };
                    copyToClipboard(JSON.stringify(jobData, null, 2));
                  }}
                  className="p-1 text-gray-600 hover:text-gray-800"
                  title="Copy complete job data"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                  Click to view complete job object
                </summary>
                <pre className="mt-2 text-gray-700 bg-white p-3 rounded border overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                  {JSON.stringify({
                    ...job,
                    startTime: job.startTime?.toDate?.()?.toISOString(),
                    endTime: job.endTime?.toDate?.()?.toISOString()
                  }, null, 2)}
                </pre>
              </details>
            </div>
          </div>

          {/* Close Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailsModal;
