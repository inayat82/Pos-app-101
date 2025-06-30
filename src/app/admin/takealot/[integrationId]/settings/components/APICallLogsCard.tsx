'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiActivity, FiRefreshCw, FiEye, FiSettings, FiClock
} from 'react-icons/fi';
import { 
  formatDuration, 
  formatTimestamp, 
  getStatusStyling, 
  getTypeStyling, 
  formatStatusText, 
  formatTypeText,
  calculatePaginationInfo 
} from '../utils/apiLogsUtils';

interface APICallLogsCardProps {
  integrationId: string;
  showMessage: (type: 'success' | 'error', message: string) => void;
}

interface ApiLog {
  id?: string;
  createdAt?: string;
  operation?: string;
  trigger?: string;
  type?: 'sales' | 'products';
  recordsFetched?: number;
  totalRecords?: number;
  pagesFetched?: number;
  totalPages?: number;
  recordsSaved?: number;
  duplicates?: number;
  recordsUpdated?: number;
  updatedRecords?: number;
  newRecords?: number;
  duration?: number;
  status?: 'success' | 'completed' | 'error' | 'failed' | 'running';
}

const APICallLogsCard: React.FC<APICallLogsCardProps> = ({
  integrationId,
  showMessage
}) => {
  // API Logs State
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logsPerPage, setLogsPerPage] = useState(10);

  // Load API logs function
  const loadApiLogs = useCallback(async (page: number = 1) => {
    if (!integrationId) return;

    setIsLoadingLogs(true);
    try {
      console.log(`Loading API logs for integration: ${integrationId}, page: ${page}`);
      
      // For now, let's use the SuperAdmin API as a workaround to get logs
      const response = await fetch(`/api/superadmin/cron-job-logs?limit=${logsPerPage}&offset=${(page - 1) * logsPerPage}`);
      
      console.log('Fetch logs response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetch logs response data:', data);
        
        // Filter logs for this integration (since SuperAdmin API returns all logs)
        const filteredLogs = data.logs?.filter((log: any) => 
          log.integrationId === integrationId || 
          (log.adminId && integrationId.includes(log.adminId)) ||
          log.cronJobName?.includes('sales') || log.cronJobName?.includes('product')
        ).map((log: any) => ({
          // Map SuperAdmin API fields to component expected fields
          id: log.id,
          createdAt: log.createdAt || log.timestamp,
          operation: log.cronJobName?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Manual Sync',
          trigger: log.triggerType === 'manual' ? 'Manual' : 
                  log.triggerType === 'cron' ? 'Automated' : 'Unknown',
          type: log.cronJobName?.includes('sales') ? 'sales' : 
                log.cronJobName?.includes('product') ? 'products' : 'sync',
          recordsFetched: log.totalReads || 0,
          totalRecords: log.totalReads || 0,
          recordsSaved: log.totalWrites || 0,
          recordsUpdated: log.totalWrites || 0,
          newRecords: log.totalWrites || 0,
          duration: log.duration || 0,
          status: log.status === 'success' ? 'completed' : 
                 log.status === 'failure' ? 'failed' : 
                 log.status || 'unknown'
        })) || [];
        
        console.log(`Filtered ${filteredLogs.length} logs for integration ${integrationId}`);
        
        setApiLogs(filteredLogs);
        setTotalLogs(filteredLogs.length);
        setTotalPages(Math.ceil(filteredLogs.length / logsPerPage));
        setCurrentPage(page);
        console.log(`Loaded ${filteredLogs.length} API logs (page ${page})`);
      } else {
        const errorText = await response.text();
        console.error('Failed to load API logs:', response.status, errorText);
        showMessage('error', `Failed to load API logs: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error loading API logs:', error);
      showMessage('error', `Error loading API logs: ${error}`);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [integrationId, logsPerPage, showMessage]);

  // Load logs on component mount and when dependencies change
  useEffect(() => {
    if (integrationId) {
      loadApiLogs(1);
    }
  }, [integrationId, logsPerPage, loadApiLogs]);

  // Helper function to format timestamp components
  const getTimestampDisplay = (createdAt: string | undefined) => {
    const { date, time } = formatTimestamp(createdAt);
    return { date, time };
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-8 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-gradient-to-br from-white via-white to-gray-50/30">
      {/* Header Section */}
      <div className="border-b border-gradient-to-r from-transparent via-gray-200 to-transparent pb-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur-lg opacity-30 animate-pulse-slow"></div>
              <div className="relative p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <FiActivity className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">API Call Logs</h2>
              <p className="text-sm text-gray-500 mt-1">Monitor all fetch operations and their detailed results</p>
              <div className="flex items-center space-x-2 mt-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">Real-time monitoring</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 border border-indigo-200 shadow-sm">
              Enhanced Logs
            </span>
            {totalLogs > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                {totalLogs} total calls
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-6 mb-8 border border-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200">
              <FiClock className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">Show:</span>
              <select
                value={logsPerPage}
                onChange={(e) => {
                  const newLogsPerPage = parseInt(e.target.value);
                  setLogsPerPage(newLogsPerPage);
                  setCurrentPage(1);
                  loadApiLogs(1);
                }}
                className="px-3 py-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg font-medium text-gray-700 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">records</span>
            </div>
            
            {totalLogs > 0 && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => loadApiLogs(currentPage)}
            disabled={isLoadingLogs}
            className="group relative px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-indigo-300/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            {isLoadingLogs ? (
              <div className="flex items-center space-x-2 relative z-10">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Refreshing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 relative z-10">
                <FiRefreshCw className="w-4 h-4" />
                <span>Refresh Logs</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="relative bg-gradient-to-br from-gray-50 via-white to-gray-50/30 rounded-2xl p-1 overflow-hidden shadow-inner border border-gray-200/50">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-30"></div>
        <div className="relative overflow-x-auto rounded-xl">
          <table className="w-full text-sm bg-white/80 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border-b border-gray-200/70">
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Timestamp</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Operation</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Type</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">API Response</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">DB Saved</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">DB Update</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Duration</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Status</th>
                <th className="text-left py-5 px-6 font-semibold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/70">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200"></div>
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent absolute inset-0"></div>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-700 text-lg">Loading API logs...</p>
                        <p className="text-sm text-gray-500 mt-1">Please wait while we fetch the latest data</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : apiLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                          <FiSettings className="w-8 h-8 text-gray-400" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-700 text-lg">No API calls recorded yet</p>
                        <p className="text-sm text-gray-500 mt-1">Fetch operations will appear here once you start using the API</p>
                        <div className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200/50">
                          <p className="text-xs text-indigo-600">Tip: Use the manual sync feature to generate your first logs</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                apiLogs.map((log, index) => {
                  const { date, time } = getTimestampDisplay(log.createdAt);
                  
                  return (
                    <tr key={log.id || index} className="group hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-all duration-300 border-b border-gray-100/50">
                      <td className="py-5 px-6">
                        <div className="flex flex-col space-y-1">
                          <div className="text-sm font-semibold text-gray-800">{date}</div>
                          <div className="text-xs text-gray-500 flex items-center space-x-1">
                            <FiClock className="w-3 h-3" />
                            <span>{time}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col space-y-1">
                          <div className="font-semibold text-gray-900">{log.operation || 'Unknown Operation'}</div>
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md inline-block">{log.trigger || 'Manual Fetch'}</div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold shadow-sm border ${getTypeStyling(log.type)}`}>
                          {formatTypeText(log.type)}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                            <span className="text-emerald-700 font-semibold">{log.recordsFetched || log.totalRecords || 0} records</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            {log.pagesFetched || log.totalPages || 0} pages fetched
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <span className="text-blue-700 font-semibold">{log.recordsSaved || log.recordsFetched || 0} saved</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            {log.duplicates || 0} duplicates found
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                            <span className="text-purple-700 font-semibold">{log.recordsUpdated || log.updatedRecords || 0} updated</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            {log.newRecords || (log.recordsSaved && log.recordsUpdated ? log.recordsSaved - log.recordsUpdated : 0) || 0} new records
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center space-x-2">
                          <FiClock className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-700 font-semibold text-sm">
                            {formatDuration(log.duration)}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold shadow-sm border ${getStatusStyling(log.status)}`}>
                          {formatStatusText(log.status)}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <button className="group/btn relative overflow-hidden text-indigo-600 hover:text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 border border-indigo-200 hover:border-transparent hover:shadow-lg transform hover:-translate-y-0.5">
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                          <div className="relative z-10 flex items-center space-x-2">
                            <FiEye className="w-4 h-4" />
                            <span>View</span>
                          </div>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoadingLogs && apiLogs.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-6 mt-8 border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200">
                <div className="text-sm text-gray-600">
                  {(() => {
                    const { start, end, total } = calculatePaginationInfo(currentPage, logsPerPage, totalLogs);
                    return (
                      <div className="flex items-center space-x-2">
                        <span>Showing</span>
                        <span className="font-semibold text-indigo-600">{start}</span>
                        <span>-</span>
                        <span className="font-semibold text-indigo-600">{end}</span>
                        <span>of</span>
                        <span className="font-semibold text-purple-600">{total}</span>
                        <span>API calls</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              <div className="text-xs text-gray-500 bg-white px-3 py-2 rounded-lg border border-gray-200">
                Page {currentPage} of {totalPages}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => loadApiLogs(currentPage - 1)}
                disabled={currentPage <= 1}
                className="group px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:transform-none"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Previous</span>
                </div>
              </button>
              
              <div className="flex items-center space-x-2">
                {/* Show first page */}
                {currentPage > 3 && (
                  <>
                    <button 
                      onClick={() => loadApiLogs(1)}
                      className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-indigo-600 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-indigo-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="text-gray-400 text-sm px-2">...</span>}
                  </>
                )}
                
                {/* Show previous page */}
                {currentPage > 1 && (
                  <button 
                    onClick={() => loadApiLogs(currentPage - 1)}
                    className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-indigo-600 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-indigo-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    {currentPage - 1}
                  </button>
                )}
                
                {/* Current page */}
                <button className="relative px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg border-2 border-white transform scale-105">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl"></div>
                  <span className="relative z-10">{currentPage}</span>
                </button>
                
                {/* Show next page */}
                {currentPage < totalPages && (
                  <button 
                    onClick={() => loadApiLogs(currentPage + 1)}
                    className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-indigo-600 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-indigo-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    {currentPage + 1}
                  </button>
                )}
                
                {/* Show last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="text-gray-400 text-sm px-2">...</span>}
                    <button 
                      onClick={() => loadApiLogs(totalPages)}
                      className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-indigo-600 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-indigo-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              <button 
                onClick={() => loadApiLogs(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="group px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:transform-none"
              >
                <div className="flex items-center space-x-2">
                  <span>Next</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APICallLogsCard;
