// src/components/admin/EnhancedJobStatusLogsCard2.tsx
import React, { useState } from 'react';
import { FiCopy, FiEye, FiClock, FiCheck, FiX, FiActivity } from 'react-icons/fi';
import type { JobLogUI } from '@/types/job';

interface EnhancedJobStatusLogsCardProps {
  runningJobs: JobLogUI[];
  completedJobs: JobLogUI[];
  activeJobView: 'running' | 'history';
  setActiveJobView: (view: 'running' | 'history') => void;
  isLoadingHistory: boolean;
  currentHistoryPage?: number;
  totalHistoryPages?: number;
  onLoadHistoryPage?: (page: number) => void;
}

const EnhancedJobStatusLogsCard2: React.FC<EnhancedJobStatusLogsCardProps> = ({
  runningJobs,
  completedJobs,
  activeJobView,
  setActiveJobView,
  isLoadingHistory,
  currentHistoryPage = 1,
  totalHistoryPages = 1,
  onLoadHistoryPage,
}) => {
  const jobsToDisplay = activeJobView === 'running' ? runningJobs : completedJobs;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheck className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <FiX className="w-4 h-4 text-red-500" />;
      case 'running':
        return <FiActivity className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <FiClock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const copyJobSummary = (job: JobLogUI) => {
    const summary = `Job Summary:
- Message: ${job.statusMessage || job.overallMessage || 'No message'}
- Total Requests: ${job.totalRequestsSent || 1}
- API Endpoint: ${job.apiEndpoint || 'N/A'}
- Records Fetched: ${job.totalRecordsFetched || job.successfulItems || 0}
- Records Saved: ${job.totalRecordsSaved || 0}
- Duration: ${job.duration ? Math.round(job.duration / 1000) + 's' : 'N/A'}
- Status: ${job.status}`;
    
    navigator.clipboard.writeText(summary);
    alert('Job summary copied to clipboard!');
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Enhanced Job Status & Logs</h3>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveJobView('running')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeJobView === 'running'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Running ({runningJobs.length})
            </button>
            <button
              onClick={() => setActiveJobView('history')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeJobView === 'history'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              History ({completedJobs.length})
            </button>
          </div>
        </div>

        {isLoadingHistory && activeJobView === 'history' ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading job history...</span>
          </div>
        ) : jobsToDisplay.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm">
              No {activeJobView === 'running' ? 'running' : 'completed'} jobs found
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {jobsToDisplay.map((job, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {job.dataType} Sync
                      </h4>                      <p className="text-xs text-gray-500">
                        {new Date(job.startTime?.toDate?.() || job.startTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyJobSummary(job)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy Summary"
                    >
                      <FiCopy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className={`ml-1 font-medium ${
                      job.status === 'completed' ? 'text-green-600' :
                      job.status === 'failed' ? 'text-red-600' :
                      job.status === 'running' ? 'text-blue-600' : 'text-yellow-600'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Records:</span>
                    <span className="ml-1 font-medium text-gray-900">
                      {job.totalRecordsFetched || job.successfulItems || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Saved:</span>
                    <span className="ml-1 font-medium text-gray-900">
                      {job.totalRecordsSaved || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <span className="ml-1 font-medium text-gray-900">
                      {job.duration ? Math.round(job.duration / 1000) + 's' : 'N/A'}
                    </span>
                  </div>
                </div>

                {job.statusMessage && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600">{job.statusMessage}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination for history */}
        {activeJobView === 'history' && totalHistoryPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentHistoryPage} of {totalHistoryPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onLoadHistoryPage?.(currentHistoryPage - 1)}
                disabled={currentHistoryPage <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => onLoadHistoryPage?.(currentHistoryPage + 1)}
                disabled={currentHistoryPage >= totalHistoryPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedJobStatusLogsCard2;
