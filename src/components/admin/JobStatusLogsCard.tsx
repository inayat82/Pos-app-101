// src/components/admin/JobStatusLogsCard.tsx
import React, { useState } from 'react';
import { FiEye, FiSave } from 'react-icons/fi';
import type { JobLogUI } from '@/types/job';
import JobDetailsModal from './JobDetailsModal';

interface JobStatusLogsCardProps {
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

const JobStatusLogsCard: React.FC<JobStatusLogsCardProps> = ({
  runningJobs,
  completedJobs,
  activeJobView,
  setActiveJobView,
  isLoadingHistory,
  currentHistoryPage = 1,
  totalHistoryPages = 1,
  onLoadHistoryPage,
}) => {
  const [selectedJob, setSelectedJob] = useState<JobLogUI | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const jobsToDisplay = activeJobView === 'running' ? runningJobs : completedJobs;

  const openJobDetails = (job: JobLogUI) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const closeJobDetails = () => {
    setSelectedJob(null);
    setIsModalOpen(false);
  };
  const getStatusDisplay = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' || statusLower === 'success') {
      return { text: 'Success', color: 'bg-green-100 text-green-800' };
    } else if (statusLower === 'error' || statusLower === 'failed') {
      return { text: 'Failed', color: 'bg-red-100 text-red-800' };
    } else if (statusLower === 'running') {
      return { text: 'Running', color: 'bg-blue-100 text-blue-800' };
    } else if (statusLower === 'queued') {
      return { text: 'Queued', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { text: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const saveJobSummary = (job: JobLogUI) => {
    const statusDisplay = getStatusDisplay(job.status);
    const summary = `
=== JOB SUMMARY ===
Job ID: ${job.jobId}
Type: ${job.dataType}
Status: ${statusDisplay.text}
Strategy: ${job.strategyDescription || 'N/A'}

=== RECORDS ===
Fetched: ${job.totalRecordsFetched || job.successfulItems || 0}
Saved: ${job.totalRecordsSaved || 0}
Successful: ${job.successfulItems || 0}
Errors: ${job.errorItems || 0}

=== API INFORMATION ===
Total Requests Sent: ${job.totalRequestsSent || 0}
API Endpoint: ${job.apiEndpoint || 'N/A'}
Average Response Time: ${job.averageResponseTime ? Math.round(job.averageResponseTime) + 'ms' : 'N/A'}

=== REQUEST HEADERS ===
${job.requestHeaders ? JSON.stringify(job.requestHeaders, null, 2) : 'N/A'}

=== FULL MESSAGE ===
${job.statusMessage || job.overallMessage || 'No message'}

=== API RESPONSE (First 20 lines) ===
${job.lastApiResponse ? job.lastApiResponse.split('\n').slice(0, 20).join('\n') : 'No response data available'}

=== ERROR DETAILS ===
${job.errorDetails || 'No errors'}

=== TIMESTAMPS ===
Started: ${job.startTime?.toDate ? job.startTime.toDate().toLocaleString() : 'N/A'}
${job.endTime ? `Ended: ${job.endTime?.toDate ? job.endTime.toDate().toLocaleString() : 'N/A'}` : ''}
Duration: ${job.duration ? Math.round(job.duration / 1000) + 's' : 'N/A'}
    `;    navigator.clipboard.writeText(summary);
    alert('Complete job summary with API details copied to clipboard!');
  };

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 md:p-8 mb-8 border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Enhanced Job Status & Logs - NEW VERSION</h2>
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

      {jobsToDisplay.length > 0 && (        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Job ID / Type</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Status</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Strategy</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Records Fetched</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Records Saved</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Timings</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">Message & Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobsToDisplay.map((job) => {
                const statusDisplay = getStatusDisplay(job.status);
                return (
                  <tr key={job.jobId} className={`${
                    statusDisplay.text === 'Failed' ? 'bg-red-50' : 
                    statusDisplay.text === 'Running' ? 'bg-blue-50' : 
                    statusDisplay.text === 'Queued' ? 'bg-yellow-50' : ''
                  }`}>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 truncate w-32" title={job.jobId}>{job.jobId}</div>
                      <div className="text-xs text-gray-500 capitalize">{job.dataType}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusDisplay.color}`}>
                        {statusDisplay.text}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="truncate w-24" title={job.strategyDescription || 'N/A'}>
                        {job.strategyDescription || 'N/A'}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {job.totalRecordsFetched !== undefined ? job.totalRecordsFetched.toLocaleString() : 
                       job.successfulItems !== undefined ? job.successfulItems.toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {job.totalRecordsSaved !== undefined ? job.totalRecordsSaved.toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="text-xs">
                        <div>Start: {job.startTime?.toDate ? job.startTime.toDate().toLocaleString() : new Date(job.startTime as any as number).toLocaleString()}</div>
                        {job.endTime && <div>End: {job.endTime?.toDate ? job.endTime.toDate().toLocaleString() : new Date(job.endTime as any as number).toLocaleString()}</div>}
                        {job.status === 'running' && job.totalPages && job.currentPage && (
                          <div className="mt-1">
                            <div>Page: {job.currentPage}/{job.totalPages}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${((job.currentPage || 0) / (job.totalPages || 1)) * 100}%` }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500 min-w-0 w-64">
                      <div className="space-y-2">
                        <div className="truncate max-w-xs" title={job.statusMessage || job.overallMessage || 'No message'}>
                          {job.statusMessage || job.overallMessage || 'No message'}
                        </div>
                        <div className="flex space-x-1 flex-wrap">
                          <button
                            onClick={() => saveJobSummary(job)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors whitespace-nowrap"
                            title="Save complete job summary with API details to clipboard"
                          >
                            <FiSave className="w-3 h-3 mr-1" />
                            Save
                          </button>
                          <button
                            onClick={() => openJobDetails(job)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors whitespace-nowrap"
                            title="View full message, total requests, API endpoint, headers & first 20 lines of response"
                          >
                            <FiEye className="w-3 h-3 mr-1" />
                            View
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
        onClose={closeJobDetails}
      />
    </div>
  );
};

export default JobStatusLogsCard;
