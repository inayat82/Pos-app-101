// src/components/admin/SyncJobMonitor.tsx

'use client';

import React, { useState, useEffect } from 'react';

interface SyncJobData {
  id: string;
  adminId: string;
  dataType: 'products' | 'sales';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  currentPage: number;
  totalPages: number | null;
  totalItemsProcessed: number;
  cronLabel: string;
  progressPercentage: number | null;
}

interface SyncStats {
  activeJobs: number;
  activeProductJobs: number;
  activeSalesJobs: number;
  completedJobsLast24h: number;
  totalItemsProcessedLast24h: number;
  errorRate: number;
}

interface SyncJobMonitorProps {
  adminId?: string;
}

interface MonitorResponse {
  success: boolean;
  stats?: SyncStats;
  activeJobs?: SyncJobData[];
  message?: string;
  isPaginatedSystemActive?: boolean;
  recentLogs?: any[];
}

export default function SyncJobMonitor({ adminId }: SyncJobMonitorProps) {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [activeJobs, setActiveJobs] = useState<SyncJobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [isPaginatedActive, setIsPaginatedActive] = useState(false);
  const [legacyLogs, setLegacyLogs] = useState<any[]>([]);

  const fetchSyncData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/sync-jobs');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sync data: ${response.statusText}`);
      }

      const data: MonitorResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch sync data');
      }

      setStats(data.stats || null);
      setIsPaginatedActive(data.isPaginatedSystemActive || false);
      
      // Filter active jobs by adminId if provided
      const filteredJobs = adminId 
        ? (data.activeJobs || []).filter((job: SyncJobData) => job.adminId === adminId)
        : (data.activeJobs || []);
      
      setActiveJobs(filteredJobs);
      setLegacyLogs(data.recentLogs || []);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching sync data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSyncData, 30000);
    
    return () => clearInterval(interval);
  }, [adminId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-green-500">✓</span>;
      case 'failed':
        return <span className="text-red-500">✗</span>;
      case 'in_progress':
        return <span className="text-blue-500">⟳</span>;
      case 'pending':
        return <span className="text-yellow-500">⏱</span>;
      default:
        return <span className="text-gray-500">?</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      in_progress: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-gray-100 text-gray-800"
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.cancelled}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading && !stats) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-2">
          <span className="animate-spin">⟳</span>
          <h3 className="text-lg font-semibold">Loading Sync Status...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <span>✗</span>
          <h3 className="text-lg font-semibold">Sync Monitor Error</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={fetchSyncData} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          ⟳ Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pre-deployment Notice */}
      {!isPaginatedActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800 mb-2">
            <span>ℹ️</span>
            <h4 className="font-semibold">Paginated Sync System Not Yet Active</h4>
          </div>
          <p className="text-blue-700 text-sm">
            The new paginated sync system has been implemented but needs to be deployed. 
            Currently showing legacy sync data from existing logs.
          </p>
          <div className="mt-2 text-xs text-blue-600">
            After deployment, you'll see real-time progress tracking with active jobs and detailed statistics.
          </div>
        </div>
      )}

      {/* Statistics Overview */}
      {stats && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isPaginatedActive ? 'Live Sync Status' : 'Legacy Sync Summary'}
            </h3>
            <button 
              onClick={fetchSyncData}
              disabled={loading}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <span className={loading ? 'animate-spin' : ''}>⟳</span> Refresh
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.activeJobs}</div>
              <div className="text-sm text-gray-600">
                {isPaginatedActive ? 'Active Jobs' : 'Active Jobs (Legacy)'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completedJobsLast24h}</div>
              <div className="text-sm text-gray-600">Completed (24h)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.totalItemsProcessedLast24h.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Items Processed (24h)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.activeProductJobs}</div>
              <div className="text-sm text-gray-600">Product Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{stats.activeSalesJobs}</div>
              <div className="text-sm text-gray-600">Sales Jobs</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${stats.errorRate > 10 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.errorRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Error Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Jobs (Paginated System) */}
      {isPaginatedActive && activeJobs.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">
            Active Sync Jobs {adminId && `(${adminId})`}
          </h3>
          
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className="font-medium">
                      {job.dataType.charAt(0).toUpperCase() + job.dataType.slice(1)} Sync
                    </span>
                    {getStatusBadge(job.status)}
                  </div>
                  <span className="text-sm text-gray-600">{job.cronLabel}</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Page:</span> {job.currentPage}
                    {job.totalPages && ` / ${job.totalPages}`}
                  </div>
                  <div>
                    <span className="text-gray-600">Items:</span> {job.totalItemsProcessed.toLocaleString()}
                  </div>
                  <div>
                    <span className="text-gray-600">Progress:</span> {
                      job.progressPercentage !== null 
                        ? `${job.progressPercentage}%` 
                        : 'Unknown'
                    }
                  </div>
                  <div className="text-xs text-gray-500">
                    ID: {job.id.slice(0, 8)}...
                  </div>
                </div>

                {job.progressPercentage !== null && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(job.progressPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Sync Logs (Before Paginated System) */}
      {!isPaginatedActive && legacyLogs.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Recent Sync Activity (Legacy)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {legacyLogs.slice(0, 10).map((log: any, index) => (
              <div key={log.id || index} className="text-sm border-l-4 border-blue-200 pl-3 py-1">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${
                    log.type === 'error' || log.type === 'fatal_error' ? 'text-red-600' : 'text-gray-800'
                  }`}>
                    {log.cronLabel || 'Unknown'} - {log.type || 'info'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : 'Unknown time'}
                  </span>
                </div>
                {log.message && (
                  <div className="text-gray-600 mt-1">{log.message}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Active Jobs */}
      {isPaginatedActive && activeJobs.length === 0 && stats && (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <span className="text-green-500 text-4xl">✓</span>
          <h3 className="text-lg font-medium mb-2 mt-4">All Sync Jobs Complete</h3>
          <p className="text-gray-600">
            No active sync jobs running {adminId && 'for this integration'}.
          </p>
        </div>
      )}

      {/* Deployment Instructions */}
      {!isPaginatedActive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <span>🚀</span>
            <h4 className="font-semibold">Ready for Deployment</h4>
          </div>
          <p className="text-yellow-700 text-sm mb-2">
            The paginated sync system is implemented and ready to deploy. After deployment, this monitor will show:
          </p>
          <ul className="text-yellow-700 text-sm list-disc list-inside space-y-1">
            <li>Real-time progress bars for active sync jobs</li>
            <li>Detailed statistics and performance metrics</li>
            <li>Chunk-by-chunk processing status</li>
            <li>No more timeout errors for large datasets</li>
          </ul>
        </div>
      )}

      {/* Last Refresh Time */}
      <div className="text-xs text-gray-500 text-center">
        Last updated: {lastRefresh.toLocaleTimeString()}
        {!isPaginatedActive && ' (Legacy data)'}
      </div>
    </div>
  );
}
