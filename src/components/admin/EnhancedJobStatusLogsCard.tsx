// src/components/admin/EnhancedJobStatusLogsCard.tsx
import React, { useState } from 'react';
import { FiCopy } from 'react-icons/fi';
import type { JobLogUI } from '@/types/job';
import JobDetailsModal from './JobDetailsModal';

interface EnhancedJobStatusLogsCardProps {
  runningJobs: JobLogUI[];
  completedJobs: JobLogUI[];
  activeJobView: 'running' | 'history';
  setActiveJobView: (view: 'running' | 'history') => void;
  isLoadingHistory: boolean;
  // Pagination props
  currentHistoryPage?: number;
  totalHistoryPages?: number;
  onLoadHistoryPage?: (page: number) => void;
}

const EnhancedJobStatusLogsCard: React.FC<EnhancedJobStatusLogsCardProps> = ({
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
  const [selectedJob, setSelectedJob] = useState<JobLogUI | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleJobDetailsClick = (job: JobLogUI) => {
    setSelectedJob(job);
    setIsModalOpen(true);
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
    <div className="bg-white shadow-lg rounded-xl p-6 md:p-8 mb-8 border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Enhanced Job Status & Logs</h2>
        <div>
          <button
            onClick={() => setActiveJobView('running')}
            className={`px-4 py-2 mr-2 rounded-md text-sm font-medium ${
              activeJobView === 'running' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Running ({runningJobs.length})
          </button>
          <button
            onClick={() => setActiveJobView('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeJobView === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            History ({completedJobs.length})
          </button>
        </div>
      </div>

      {isLoadingHistory && activeJobView === 'history' && <p className="text-gray-500 italic">Loading job history...</p>}
      {!isLoadingHistory && jobsToDisplay.length === 0 && (
        <p className="text-gray-500 italic">
          {activeJobView === 'running' ? 'No jobs currently running.' : 'No job history found.'}
        </p>
      )}

      {jobsToDisplay.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID / Type</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Info</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message & Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobsToDisplay.map((job) => (
                <tr key={job.jobId} className={`${
                  job.status === 'error' || job.status === 'failed' ? 'bg-red-50' : 
                  job.status === 'success' || job.status === 'completed' ? 'bg-green-50' :
                  job.status === 'running' || job.status === 'queued' ? 'bg-yellow-50' : ''
                }`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 truncate w-32" title={job.jobId}>{job.jobId}</div>
                    <div className="text-xs text-gray-500 capitalize">{job.dataType}</div>
                    {job.duration && (
                      <div className="text-xs text-gray-400">
                        Duration: {Math.round(job.duration / 1000)}s
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {job.strategyDescription || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${job.status === 'completed' || job.status === 'success' ? 'bg-green-100 text-green-800' :
                        job.status === 'error' || job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        (job.status === 'running' || job.status === 'queued') ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {job.status === 'completed' && job.totalRecordsSaved ? 'success' : job.status}
                    </span>
                    {job.startTime && (
                      <div className="text-xs text-gray-400 mt-1">
                        {job.startTime?.toDate ? job.startTime.toDate().toLocaleTimeString() : 'Invalid date'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="space-y-1">
                      <div className="text-xs">
                        <span className="font-medium text-blue-600">Fetched:</span> {job.totalRecordsFetched || job.successfulItems || 0}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-green-600">Saved:</span> {job.totalRecordsSaved || 0}
                      </div>
                      {(job.errorItems || 0) > 0 && (
                        <div className="text-xs">
                          <span className="font-medium text-red-600">Errors:</span> {job.errorItems}
                        </div>
                      )}
                      {job.currentPage && job.totalPages && (
                        <div className="text-xs text-gray-400">
                          Page: {job.currentPage}/{job.totalPages}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <div className="space-y-1">
                      {job.totalRequestsSent && (
                        <div className="text-xs">
                          <span className="font-medium">Requests:</span> {job.totalRequestsSent}
                        </div>
                      )}
                      {job.apiEndpoint && (
                        <div className="text-xs">
                          <span className="font-medium">Endpoint:</span>
                          <br />
                          <code className="bg-gray-100 px-1 rounded text-xs">
                            {job.apiEndpoint.length > 40 ? `${job.apiEndpoint.substring(0, 40)}...` : job.apiEndpoint}
                          </code>
                        </div>
                      )}
                      {job.averageResponseTime && (
                        <div className="text-xs text-gray-400">
                          Avg Response: {Math.round(job.averageResponseTime)}ms
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <div className="max-w-xs space-y-2">
                      {/* Enhanced Message Display */}
                      <div className="bg-gray-50 p-2 rounded border">
                        <div className="text-xs font-medium text-gray-600 mb-1">Message:</div>
                        <div 
                          className="text-sm text-gray-900 overflow-hidden" 
                          style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}} 
                          title={job.statusMessage || job.overallMessage || 'No message'}
                        >
                          {job.statusMessage || job.overallMessage || 'No message'}
                        </div>
                        {(job.statusMessage || job.overallMessage) && (job.statusMessage || job.overallMessage)!.length > 60 && (
                          <div className="text-xs text-gray-500 mt-1">Click "View" for full message</div>
                        )}
                      </div>

                      {/* Enhanced Summary Info */}
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Requests:</span>
                          <span className="font-medium">{job.totalRequestsSent || 1}</span>
                        </div>
                        {job.apiEndpoint && (
                          <div className="flex justify-between">
                            <span>Endpoint:</span>
                            <span className="font-mono text-xs truncate max-w-24" title={job.apiEndpoint}>
                              {job.apiEndpoint.includes('api/') ? job.apiEndpoint.split('api/')[1] : job.apiEndpoint}
                            </span>
                          </div>
                        )}
                        {job.lastApiResponse && (
                          <div className="text-green-600">
                            <span>✓ API Response Available</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleJobDetailsClick(job)}
                          className="flex-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                          View Full Details
                        </button>
                        <button
                          onClick={() => copyJobSummary(job)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 focus:outline-none transition-colors"
                          title="Copy job summary"
                        >
                          📋
                        </button>
                      </div>
                      
                      {job.errorDetails && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                          <div className="font-medium text-red-700">Error:</div>
                          <div 
                            className="text-red-600 overflow-hidden" 
                            style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}} 
                            title={job.errorDetails}
                          >
                            {job.errorDetails.length > 100 ? `${job.errorDetails.substring(0, 100)}...` : job.errorDetails}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls for History */}
      {activeJobView === 'history' && totalHistoryPages > 1 && onLoadHistoryPage && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Showing page {currentHistoryPage} of {totalHistoryPages} (10 logs per page)
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onLoadHistoryPage(currentHistoryPage - 1)}
              disabled={currentHistoryPage <= 1 || isLoadingHistory}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700">
              {currentHistoryPage} / {totalHistoryPages}
            </span>
            <button
              onClick={() => onLoadHistoryPage(currentHistoryPage + 1)}
              disabled={currentHistoryPage >= totalHistoryPages || isLoadingHistory}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedJob(null);
        }}
      />
    </div>
  );
};

export default EnhancedJobStatusLogsCard;
