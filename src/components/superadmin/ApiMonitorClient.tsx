'use client';

import { FC, useState, useEffect } from 'react';
import { ApiCallLog } from '@/types/api-monitor';
import { CronJobLog } from '@/types/cron-logs';
import { Eye, RefreshCw, Search, Filter, Clock, AlertTriangle, CheckCircle, Activity, Database, Server, Settings, Play, Pause, Trash2 } from 'lucide-react';
import ClearLogsModal from './ClearLogsModal';

interface CronJobStatus {
  name: string;
  schedule: string;
  expected_interval_minutes: number;
  endpoint: string;
  description: string;
  cronExpression: string;
  isActive: boolean;
  status: 'healthy' | 'overdue' | 'unhealthy' | 'no_data';
  lastExecution: Date | null;
  executions24h: number;
  errors24h: number;
  successRate: number;
  isOverdue: boolean;
  nextExpectedRun: Date | null;
  lastError: any;
}

interface AdminCronAnalysis {
  adminId: string;
  adminName: string;
  adminEmail: string;
  integrationCount: number;
  enabledIntegrations: number;
  healthStatus: 'healthy' | 'warning' | 'unhealthy' | 'critical' | 'no_data';
  metrics: {
    totalSyncs: number;
    totalErrors: number;
    successRate: number;
    totalItemsProcessed: number;
    totalPagesProcessed: number;
    avgProcessingTime: number;
    lastSyncTime: Date | null;
    hoursSinceLastSync: number | null;
  };
  cronJobFrequency: { [key: string]: { count: number; errors: number; lastRun: Date | null } };
  recentErrors: any[];
  integrations: Array<{
    id: string;
    accountName: string;
    cronEnabled: boolean;
    lastSync: Date | null;
  }>;
}

interface AdminCronResponse {
  success: boolean;
  timeRange: string;
  systemStats: {
    totalAdmins: number;
    healthyAdmins: number;
    warningAdmins: number;
    unhealthyAdmins: number;
    criticalAdmins: number;
    noDataAdmins: number;
    totalIntegrations: number;
    totalEnabledIntegrations: number;
    totalSyncs: number;
    totalErrors: number;
    overallSuccessRate: number;
  };
  adminAnalysis: AdminCronAnalysis[];
  timestamp: string;
}

interface SystemHealth {
  totalCronJobs: number;
  healthyCronJobs: number;
  overdueCronJobs: number;
  unhealthyCronJobs: number;
  activeJobs: number;
  enabledIntegrations: number;
  totalExecutions24h: number;
  totalErrors24h: number;
  overallSuccessRate: number;
  lastSystemCheck: string;
}

interface CronStatusResponse {
  success: boolean;
  systemHealth: SystemHealth;
  cronJobs: CronJobStatus[];
  databaseHealth: any;
  performanceData: any;
}

interface ApiMonitorClientProps {}

const ApiMonitorClient: FC<ApiMonitorClientProps> = ({}) => {
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ApiCallLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'logs' | 'crons' | 'health' | 'admin-analysis' | 'cron-logs'>('logs');
  
  // Cron monitoring state
  const [cronStatus, setCronStatus] = useState<CronStatusResponse | null>(null);
  const [loadingCrons, setLoadingCrons] = useState(false);
  
  // New centralized cron logs state
  const [cronLogs, setCronLogs] = useState<CronJobLog[]>([]);
  const [loadingCronLogs, setLoadingCronLogs] = useState(false);
  const [selectedCronLog, setSelectedCronLog] = useState<CronJobLog | null>(null);
  const [cronLogFilters, setCronLogFilters] = useState({
    status: 'all',
    cronJobName: 'all',
    triggerType: 'all'
  });
  
  // Admin cron analysis state
  const [adminCronData, setAdminCronData] = useState<AdminCronResponse | null>(null);
  const [loadingAdminCrons, setLoadingAdminCrons] = useState(false);
  const [adminTimeRange, setAdminTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  
  // Clear logs modal state
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);
  
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false
  });

  const fetchCronStatus = async () => {
    setLoadingCrons(true);
    
    try {
      const response = await fetch('/api/superadmin/cron-status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch cron status');
      }

      const data = await response.json();
      
      if (data.success) {
        setCronStatus(data);
      } else {
        setError(data.message || 'Failed to fetch cron status');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching cron status');
    } finally {
      setLoadingCrons(false);
    }
  };

  const fetchAdminCronAnalysis = async () => {
    setLoadingAdminCrons(true);
    
    try {
      const response = await fetch(`/api/superadmin/admin-cron-analysis?timeRange=${adminTimeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch admin cron analysis');
      }

      const data = await response.json();
      
      if (data.success) {
        setAdminCronData(data);
      } else {
        setError(data.message || 'Failed to fetch admin cron analysis');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching admin cron analysis');
    } finally {
      setLoadingAdminCrons(false);
    }
  };

  const fetchCronJobLogs = async () => {
    setLoadingCronLogs(true);
    
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      if (cronLogFilters.status !== 'all') {
        params.append('status', cronLogFilters.status);
      }
      if (cronLogFilters.cronJobName !== 'all') {
        params.append('cronJobName', cronLogFilters.cronJobName);
      }
      if (cronLogFilters.triggerType !== 'all') {
        params.append('triggerType', cronLogFilters.triggerType);
      }

      const response = await fetch(`/api/superadmin/cron-job-logs?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cron job logs');
      }

      const data = await response.json();
      
      if (data.success) {
        setCronLogs(data.logs);
        setPagination(prev => ({
          ...prev,
          total: data.total,
          hasMore: data.hasMore
        }));
      } else {
        setError(data.message || 'Failed to fetch cron job logs');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching cron job logs');
    } finally {
      setLoadingCronLogs(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (triggerFilter !== 'all') {
        params.append('triggerType', triggerFilter);
      }

      const response = await fetch(`/api/superadmin/api-logs?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch API logs');
      }

      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs);
        setPagination(prev => ({
          ...prev,
          total: data.total,
          hasMore: data.hasMore
        }));
      } else {
        setError(data.message || 'Failed to fetch API logs');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'crons' || activeTab === 'health') {
      fetchCronStatus();
    } else if (activeTab === 'admin-analysis') {
      fetchAdminCronAnalysis();
    } else if (activeTab === 'cron-logs') {
      fetchCronJobLogs();
    }
  }, [pagination.offset, statusFilter, triggerFilter, activeTab, adminTimeRange, cronLogFilters]);

  const filteredLogs = logs.filter(log => 
    searchTerm === '' || 
    log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.takealotAccountName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = () => {
    if (activeTab === 'logs') {
      setPagination(prev => ({ ...prev, offset: 0 }));
      fetchLogs();
    } else if (activeTab === 'crons' || activeTab === 'health') {
      fetchCronStatus();
    } else if (activeTab === 'admin-analysis') {
      fetchAdminCronAnalysis();
    } else if (activeTab === 'cron-logs') {
      setPagination(prev => ({ ...prev, offset: 0 }));
      fetchCronJobLogs();
    }
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  const handlePrevPage = () => {
    setPagination(prev => ({ 
      ...prev, 
      offset: Math.max(0, prev.offset - prev.limit) 
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'overdue':
        return <Clock className="h-5 w-5 text-red-600" />;
      case 'unhealthy':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'no_data':
        return <Activity className="h-5 w-5 text-gray-400" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'overdue':
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'unhealthy':
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'no_data':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'no_data':
        return <Activity className="h-4 w-4 text-gray-400" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="bg-white shadow-md rounded-lg p-4">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'logs'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Eye className="inline h-4 w-4 mr-2" />
            Legacy API Logs
          </button>
          <button
            onClick={() => setActiveTab('cron-logs')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'cron-logs'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Settings className="inline h-4 w-4 mr-2" />
            Cron Job Logs
          </button>
          <button
            onClick={() => setActiveTab('crons')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'crons'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Clock className="inline h-4 w-4 mr-2" />
            Cron Jobs Status
          </button>
          <button
            onClick={() => setActiveTab('admin-analysis')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'admin-analysis'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Database className="inline h-4 w-4 mr-2" />
            Admin Analysis
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'health'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Activity className="inline h-4 w-4 mr-2" />
            System Health
          </button>
        </div>

        {/* System Health Overview (visible on all tabs) */}
        {cronStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Cron Jobs</p>
                  <p className="text-2xl font-bold text-blue-800">{cronStatus.systemHealth.totalCronJobs}</p>
                </div>
                <Server className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Healthy</p>
                  <p className="text-2xl font-bold text-green-800">{cronStatus.systemHealth.healthyCronJobs}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Issues</p>
                  <p className="text-2xl font-bold text-red-800">
                    {cronStatus.systemHealth.overdueCronJobs + cronStatus.systemHealth.unhealthyCronJobs}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-800">{cronStatus.systemHealth.overallSuccessRate}%</p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls (only for logs tab) */}
      {activeTab === 'logs' && (
        <div className="bg-white shadow-md rounded-lg p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search accounts or admins..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>

              {/* Filters */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="in-progress">In Progress</option>
              </select>

              <select
                value={triggerFilter}
                onChange={(e) => setTriggerFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Triggers</option>
                <option value="cron">Cron Jobs</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-4 text-sm text-gray-600">
            <span>Total: {pagination.total}</span>
            <span>Showing: {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Cron Jobs Tab */}
      {activeTab === 'crons' && (
        <>
          {/* Refresh Button for Cron Tab */}
          <div className="bg-white shadow-md rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cron Jobs Status</h3>
              <button
                onClick={handleRefresh}
                disabled={loadingCrons}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loadingCrons ? 'animate-spin' : ''}`} />
                Refresh Status
              </button>
            </div>
          </div>

          {loadingCrons && (
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading cron job status...</p>
            </div>
          )}

          {!loadingCrons && cronStatus && (
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Cron Job
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Last Execution
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        24h Stats
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Success Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cronStatus.cronJobs.map((cronJob) => (
                      <tr key={cronJob.name} className="hover:bg-gray-50">
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          <div>
                            <p className="text-gray-900 whitespace-no-wrap font-medium">
                              {cronJob.name}
                            </p>
                            <p className="text-gray-600 whitespace-no-wrap text-xs">
                              {cronJob.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          <p className="text-gray-900 whitespace-no-wrap">{cronJob.schedule}</p>
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(cronJob.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cronJob.status)}`}>
                              {cronJob.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          {cronJob.isOverdue && (
                            <p className="text-red-600 text-xs mt-1">Overdue</p>
                          )}
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          <div>
                            <p className="text-gray-900 whitespace-no-wrap">
                              {cronJob.lastExecution 
                                ? new Date(cronJob.lastExecution).toLocaleString()
                                : 'Never'
                              }
                            </p>
                            {cronJob.nextExpectedRun && (
                              <p className="text-gray-600 whitespace-no-wrap text-xs">
                                Next: {new Date(cronJob.nextExpectedRun).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          <div>
                            <p className="text-gray-900 whitespace-no-wrap">
                              {cronJob.executions24h} runs
                            </p>
                            {cronJob.errors24h > 0 && (
                              <p className="text-red-600 whitespace-no-wrap text-xs">
                                {cronJob.errors24h} errors
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  cronJob.successRate >= 90 ? 'bg-green-600' :
                                  cronJob.successRate >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                                }`}
                                style={{ width: `${cronJob.successRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{cronJob.successRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* System Health Tab */}
      {activeTab === 'health' && (
        <>
          {/* Refresh Button for Health Tab */}
          <div className="bg-white shadow-md rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">System Health Dashboard</h3>
              <button
                onClick={handleRefresh}
                disabled={loadingCrons}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loadingCrons ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {cronStatus && (
              <p className="text-sm text-gray-600 mt-2">
                Last check: {new Date(cronStatus.systemHealth.lastSystemCheck).toLocaleString()}
              </p>
            )}
          </div>

          {loadingCrons && (
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading system health...</p>
            </div>
          )}

          {!loadingCrons && cronStatus && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Database Health */}
              <div className="bg-white shadow-md rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="h-6 w-6 text-blue-600" />
                  <h4 className="text-lg font-semibold">Database Health</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Connection Status</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                      {cronStatus.databaseHealth.connectionStatus.toUpperCase()}
                    </span>
                  </div>
                  {Object.entries(cronStatus.databaseHealth.collections).map(([collection, status]) => (
                    <div key={collection} className="flex items-center justify-between">
                      <span className="text-sm">{collection}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        status === 'accessible' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {(status as string).toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {cronStatus.databaseHealth.lastSuccessfulWrite && (
                    <div className="text-xs text-gray-600 mt-2">
                      Last write: {new Date(cronStatus.databaseHealth.lastSuccessfulWrite).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Data */}
              <div className="bg-white shadow-md rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-6 w-6 text-purple-600" />
                  <h4 className="text-lg font-semibold">Performance (24h)</h4>
                </div>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Items Processed</p>
                    <p className="text-2xl font-bold text-blue-800">
                      {cronStatus.performanceData.totalItemsProcessed24h.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Total Pages Processed</p>
                    <p className="text-2xl font-bold text-green-800">
                      {cronStatus.performanceData.totalPagesProcessed24h.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Avg Processing Time</p>
                    <p className="text-2xl font-bold text-purple-800">
                      {cronStatus.performanceData.avgProcessingTime > 0 
                        ? `${(cronStatus.performanceData.avgProcessingTime / 1000).toFixed(1)}s`
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-lg">
                    <p className="text-sm text-indigo-600 font-medium">Active Integrations</p>
                    <p className="text-2xl font-bold text-indigo-800">
                      {cronStatus.systemHealth.enabledIntegrations}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Admin Cron Analysis Tab */}
      {activeTab === 'admin-analysis' && (
        <>
          {/* Controls for Admin Analysis */}
          <div className="bg-white shadow-md rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">Admin Cron Job Analysis</h3>
              <div className="flex items-center gap-4">
                <select
                  value={adminTimeRange}
                  onChange={(e) => setAdminTimeRange(e.target.value as '24h' | '7d' | '30d')}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
                <button
                  onClick={handleRefresh}
                  disabled={loadingAdminCrons}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingAdminCrons ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
            {adminCronData && (
              <p className="text-sm text-gray-600 mt-2">
                Analysis for {adminCronData.timeRange} • Last updated: {new Date(adminCronData.timestamp).toLocaleString()}
              </p>
            )}
          </div>

          {loadingAdminCrons && (
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading admin cron analysis...</p>
            </div>
          )}

          {!loadingAdminCrons && adminCronData && (
            <>
              {/* System Stats Overview */}
              <div className="bg-white shadow-md rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-4">System Overview</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Admins</p>
                    <p className="text-2xl font-bold text-blue-800">{adminCronData.systemStats.totalAdmins}</p>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Healthy</p>
                    <p className="text-2xl font-bold text-green-800">{adminCronData.systemStats.healthyAdmins}</p>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-3 rounded-lg">
                    <p className="text-sm text-yellow-600 font-medium">Warning</p>
                    <p className="text-2xl font-bold text-yellow-800">{adminCronData.systemStats.warningAdmins}</p>
                  </div>
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-3 rounded-lg">
                    <p className="text-sm text-orange-600 font-medium">Unhealthy</p>
                    <p className="text-2xl font-bold text-orange-800">{adminCronData.systemStats.unhealthyAdmins}</p>
                  </div>
                  <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">Critical</p>
                    <p className="text-2xl font-bold text-red-800">{adminCronData.systemStats.criticalAdmins}</p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Success Rate</p>
                    <p className="text-2xl font-bold text-purple-800">{adminCronData.systemStats.overallSuccessRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Admin Analysis Table */}
              <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h4 className="text-lg font-semibold">Admin Cron Job Performance</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full leading-normal">
                    <thead>
                      <tr>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Admin
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Health Status
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Integrations
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Sync Performance
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Last Sync
                        </th>
                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Cron Job Frequency
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminCronData.adminAnalysis.map((admin) => (
                        <tr key={admin.adminId} className="hover:bg-gray-50">
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div>
                              <p className="text-gray-900 whitespace-no-wrap font-medium">
                                {admin.adminName}
                              </p>
                              <p className="text-gray-600 whitespace-no-wrap text-xs">
                                {admin.adminEmail}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div className="flex items-center gap-2">
                              {getHealthStatusIcon(admin.healthStatus)}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(admin.healthStatus)}`}>
                                {admin.healthStatus.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div>
                              <p className="text-gray-900 whitespace-no-wrap">
                                {admin.enabledIntegrations} / {admin.integrationCount}
                              </p>
                              <p className="text-gray-600 whitespace-no-wrap text-xs">
                                enabled
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div>
                              <p className="text-gray-900 whitespace-no-wrap">
                                {admin.metrics.totalSyncs} syncs
                              </p>
                              <p className="text-gray-600 whitespace-no-wrap text-xs">
                                {admin.metrics.successRate.toFixed(1)}% success rate
                              </p>
                              {admin.metrics.totalErrors > 0 && (
                                <p className="text-red-600 whitespace-no-wrap text-xs">
                                  {admin.metrics.totalErrors} errors
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div>
                              {admin.metrics.lastSyncTime ? (
                                <>
                                  <p className="text-gray-900 whitespace-no-wrap">
                                    {new Date(admin.metrics.lastSyncTime).toLocaleString()}
                                  </p>
                                  <p className="text-gray-600 whitespace-no-wrap text-xs">
                                    {admin.metrics.hoursSinceLastSync !== null ? 
                                      `${admin.metrics.hoursSinceLastSync.toFixed(1)}h ago` : 
                                      ''
                                    }
                                  </p>
                                </>
                              ) : (
                                <p className="text-gray-500 whitespace-no-wrap">Never</p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div className="space-y-1">
                              {Object.entries(admin.cronJobFrequency).map(([cronJob, freq]) => (
                                <div key={cronJob} className="text-xs">
                                  <span className="font-medium">{cronJob}:</span> {freq.count} runs
                                  {freq.errors > 0 && (
                                    <span className="text-red-600 ml-1">({freq.errors} errors)</span>
                                  )}
                                </div>
                              ))}
                              {Object.keys(admin.cronJobFrequency).length === 0 && (
                                <p className="text-gray-500 text-xs">No recent cron activity</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Centralized Cron Job Logs Tab */}
      {activeTab === 'cron-logs' && (
        <>
          {/* Controls for Cron Job Logs */}
          <div className="bg-white shadow-md rounded-lg p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search cron jobs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={cronLogFilters.status}
                  onChange={(e) => setCronLogFilters(prev => ({ ...prev, status: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="timeout">Timeout</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Trigger Type Filter */}
                <select
                  value={cronLogFilters.triggerType}
                  onChange={(e) => setCronLogFilters(prev => ({ ...prev, triggerType: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Triggers</option>
                  <option value="cron">Scheduled Cron</option>
                  <option value="manual">Manual Trigger</option>
                  <option value="api">API Trigger</option>
                  <option value="webhook">Webhook</option>
                </select>

                {/* Cron Job Name Filter */}
                <select
                  value={cronLogFilters.cronJobName}
                  onChange={(e) => setCronLogFilters(prev => ({ ...prev, cronJobName: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Jobs</option>
                  <option value="Takealot Paginated Daily Sync">Paginated Daily</option>
                  <option value="Takealot Paginated Weekly Sync">Paginated Weekly</option>
                  <option value="Takealot Robust Hourly Sync">Robust Hourly</option>
                  <option value="Takealot 6-Month Sales">6-Month Sales</option>
                  <option value="Product Metrics Calculation">Product Metrics</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearLogsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Logs
                </button>
                
                <button
                  onClick={handleRefresh}
                  disabled={loadingCronLogs}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingCronLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loadingCronLogs && (
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading cron job logs...</p>
            </div>
          )}

          {/* Cron Job Logs Table */}
          {!loadingCronLogs && (
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Cron Job & Admin
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status & Trigger
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Performance Metrics
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Duration & Time
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Account Info
                      </th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cronLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center text-gray-500">
                          No cron job logs found
                        </td>
                      </tr>
                    ) : (
                      cronLogs
                        .filter(log => 
                          searchTerm === '' || 
                          log.cronJobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.adminName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.accountName?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div>
                              <p className="text-gray-900 whitespace-no-wrap font-medium">
                                {log.cronJobName}
                              </p>
                              <p className="text-gray-600 whitespace-no-wrap text-xs">
                                {log.adminName || 'System'} • {log.apiSource}
                              </p>
                              <p className="text-gray-500 whitespace-no-wrap text-xs">
                                {log.executionId}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                log.status === 'success' ? 'bg-green-100 text-green-800' :
                                log.status === 'failure' ? 'bg-red-100 text-red-800' :
                                log.status === 'running' ? 'bg-blue-100 text-blue-800' :
                                log.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {log.status.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-600">
                                {log.triggerType === 'cron' ? <Clock className="inline h-3 w-3 mr-1" /> : 
                                 log.triggerType === 'manual' ? <Play className="inline h-3 w-3 mr-1" /> : 
                                 <Settings className="inline h-3 w-3 mr-1" />}
                                {log.triggerType}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div className="text-xs">
                              <div>Pages: {log.totalPages || 0}</div>
                              <div>Reads: {log.totalReads || 0}</div>
                              <div>Writes: {log.totalWrites || 0}</div>
                              <div>Items: {log.itemsProcessed || 0}</div>
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div>
                              <p className="text-gray-900 whitespace-no-wrap text-xs">
                                {log.duration ? `${(log.duration / 1000).toFixed(1)}s` : 
                                 log.status === 'running' ? 'Running...' : '-'
                                }
                              </p>
                              <p className="text-gray-600 whitespace-no-wrap text-xs">
                                {new Date(log.startTime).toLocaleString()}
                              </p>
                              {log.endTime && (
                                <p className="text-gray-500 whitespace-no-wrap text-xs">
                                  End: {new Date(log.endTime).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <div>
                              {log.accountName && (
                                <p className="text-gray-900 whitespace-no-wrap text-xs font-medium">
                                  {log.accountName}
                                </p>
                              )}
                              {log.adminEmail && (
                                <p className="text-gray-600 whitespace-no-wrap text-xs">
                                  {log.adminEmail}
                                </p>
                              )}
                              {!log.accountName && !log.adminEmail && (
                                <p className="text-gray-500 whitespace-no-wrap text-xs">
                                  System Level
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                            <button 
                              onClick={() => setSelectedCronLog(log)} 
                              className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={pagination.offset === 0}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={!pagination.hasMore}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Loading State for Logs */}
      {activeTab === 'logs' && loading && (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading API logs...</p>
        </div>
      )}

      {/* Main Table - Only show for logs tab */}
      {activeTab === 'logs' && !loading && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account & Admin
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    API Source
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Pages/Reads/Writes
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                      {logs.length === 0 ? 'No API logs found' : 'No logs match your search criteria'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <div>
                          <p className="text-gray-900 whitespace-no-wrap font-medium">
                            {log.takealotAccountName}
                          </p>
                          <p className="text-gray-600 whitespace-no-wrap text-xs">
                            Admin: {log.adminName}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.apiSource === 'Webshare' 
                            ? 'bg-purple-100 text-purple-800' 
                            : log.apiSource === 'Takealot'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.apiSource}
                        </span>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <div>
                          <p className="text-gray-900 whitespace-no-wrap capitalize">
                            {log.triggerType}
                          </p>
                          {log.metadata?.cronLabel && (
                            <p className="text-gray-600 whitespace-no-wrap text-xs">
                              {log.metadata.cronLabel}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap">
                          {log.stats.totalPages} / {log.stats.apiReads} / {log.stats.dbWrites}
                        </p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap">
                          {log.stats.durationMs > 0 
                            ? `${(log.stats.durationMs / 1000).toFixed(1)}s`
                            : '-'
                          }
                        </p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <span
                          className={`relative inline-block px-3 py-1 font-semibold leading-tight ${
                            log.status === 'success' 
                              ? 'text-green-900' 
                              : log.status === 'failure' 
                              ? 'text-red-900' 
                              : 'text-yellow-900'
                          }`}>
                          <span
                            aria-hidden
                            className={`absolute inset-0 ${
                              log.status === 'success' 
                                ? 'bg-green-200' 
                                : log.status === 'failure' 
                                ? 'bg-red-200' 
                                : 'bg-yellow-200'
                            } opacity-50 rounded-full`}></span>
                          <span className="relative capitalize">{log.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                        <button 
                          onClick={() => setSelectedLog(log)} 
                          className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                          title="View Details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0}
                  className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!pagination.hasMore}
                  className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">API Call Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Account Information</h4>
                  <p><span className="font-medium">Account:</span> {selectedLog.takealotAccountName}</p>
                  <p><span className="font-medium">Admin:</span> {selectedLog.adminName}</p>
                  <p><span className="font-medium">Account ID:</span> {selectedLog.takealotAccountId}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Call Information</h4>
                  <p><span className="font-medium">API Source:</span> {selectedLog.apiSource}</p>
                  <p><span className="font-medium">Trigger:</span> {selectedLog.triggerType}</p>
                  <p><span className="font-medium">Time:</span> {new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>

              {/* Statistics */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Total Pages</p>
                    <p className="text-xl font-bold text-gray-900">{selectedLog.stats.totalPages}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">API Reads</p>
                    <p className="text-xl font-bold text-gray-900">{selectedLog.stats.apiReads}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">DB Writes</p>
                    <p className="text-xl font-bold text-gray-900">{selectedLog.stats.dbWrites}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="text-xl font-bold text-gray-900">
                      {selectedLog.stats.durationMs > 0 ? `${(selectedLog.stats.durationMs / 1000).toFixed(1)}s` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {selectedLog.error && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 text-red-600">Error Details</h4>
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <p><span className="font-medium">Message:</span> {selectedLog.error.message}</p>
                    {selectedLog.error.code && (
                      <p><span className="font-medium">Code:</span> {selectedLog.error.code}</p>
                    )}
                    {selectedLog.error.details && (
                      <div className="mt-2">
                        <p className="font-medium">Details:</p>
                        <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-x-auto">
                          {selectedLog.error.details}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Additional Information</h4>
                  <div className="bg-gray-50 rounded p-4">
                    {selectedLog.metadata.dataType && (
                      <p><span className="font-medium">Data Type:</span> {selectedLog.metadata.dataType}</p>
                    )}
                    {selectedLog.metadata.jobId && (
                      <p><span className="font-medium">Job ID:</span> {selectedLog.metadata.jobId}</p>
                    )}
                    {selectedLog.metadata.message && (
                      <p><span className="font-medium">Message:</span> {selectedLog.metadata.message}</p>
                    )}
                    {selectedLog.metadata.duplicatesFound !== undefined && (
                      <p><span className="font-medium">Duplicates Found:</span> {selectedLog.metadata.duplicatesFound}</p>
                    )}
                    {selectedLog.metadata.duplicatesRemoved !== undefined && (
                      <p><span className="font-medium">Duplicates Removed:</span> {selectedLog.metadata.duplicatesRemoved}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cron Job Log Details Modal */}
      {selectedCronLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Cron Job Execution Details
                </h3>
                <button
                  onClick={() => setSelectedCronLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Basic Information</h4>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                      <div><strong>Job Name:</strong> {selectedCronLog.cronJobName}</div>
                      <div><strong>Job Type:</strong> {selectedCronLog.cronJobType}</div>
                      <div><strong>Execution ID:</strong> {selectedCronLog.executionId}</div>
                      <div><strong>Status:</strong> 
                        <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedCronLog.status === 'success' ? 'bg-green-100 text-green-800' :
                          selectedCronLog.status === 'failure' ? 'bg-red-100 text-red-800' :
                          selectedCronLog.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedCronLog.status.toUpperCase()}
                        </span>
                      </div>
                      {selectedCronLog.cronSchedule && (
                        <div><strong>Schedule:</strong> {selectedCronLog.cronSchedule}</div>
                      )}
                    </div>
                  </div>

                  {/* Admin & Account Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Admin & Account Information</h4>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                      {selectedCronLog.adminName && (
                        <div><strong>Admin:</strong> {selectedCronLog.adminName}</div>
                      )}
                      {selectedCronLog.adminEmail && (
                        <div><strong>Email:</strong> {selectedCronLog.adminEmail}</div>
                      )}
                      {selectedCronLog.accountName && (
                        <div><strong>Account:</strong> {selectedCronLog.accountName}</div>
                      )}
                      {selectedCronLog.integrationId && (
                        <div><strong>Integration ID:</strong> {selectedCronLog.integrationId}</div>
                      )}
                      <div><strong>API Source:</strong> {selectedCronLog.apiSource}</div>
                    </div>
                  </div>
                </div>

                {/* Performance & Timing */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Performance Metrics</h4>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                      <div><strong>Total Pages:</strong> {selectedCronLog.totalPages || 0}</div>
                      <div><strong>Total Reads:</strong> {selectedCronLog.totalReads || 0}</div>
                      <div><strong>Total Writes:</strong> {selectedCronLog.totalWrites || 0}</div>
                      <div><strong>Items Processed:</strong> {selectedCronLog.itemsProcessed || 0}</div>
                      <div><strong>Duration:</strong> {selectedCronLog.duration ? `${(selectedCronLog.duration / 1000).toFixed(2)}s` : 'N/A'}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Timing Information</h4>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                      <div><strong>Start Time:</strong> {new Date(selectedCronLog.startTime).toLocaleString()}</div>
                      {selectedCronLog.endTime && (
                        <div><strong>End Time:</strong> {new Date(selectedCronLog.endTime).toLocaleString()}</div>
                      )}
                      <div><strong>Created:</strong> {new Date(selectedCronLog.createdAt).toLocaleString()}</div>
                      <div><strong>Updated:</strong> {new Date(selectedCronLog.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Trigger Information</h4>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
                      <div><strong>Trigger Type:</strong> {selectedCronLog.triggerType}</div>
                      {selectedCronLog.triggerSource && (
                        <div><strong>Trigger Source:</strong> {selectedCronLog.triggerSource}</div>
                      )}
                      <div><strong>Environment:</strong> {selectedCronLog.environment}</div>
                      {selectedCronLog.version && (
                        <div><strong>Version:</strong> {selectedCronLog.version}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Message and Details */}
              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Message</h4>
                  <div className="bg-gray-50 p-3 rounded-md text-sm">
                    {selectedCronLog.message || 'No message available'}
                  </div>
                </div>

                {selectedCronLog.details && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Details</h4>
                    <div className="bg-gray-50 p-3 rounded-md text-sm">
                      {selectedCronLog.details}
                    </div>
                  </div>
                )}

                {selectedCronLog.errorDetails && (
                  <div>
                    <h4 className="text-sm font-medium text-red-900 mb-2">Error Details</h4>
                    <div className="bg-red-50 p-3 rounded-md text-sm text-red-800">
                      {selectedCronLog.errorDetails}
                    </div>
                  </div>
                )}

                {selectedCronLog.stackTrace && (
                  <div>
                    <h4 className="text-sm font-medium text-red-900 mb-2">Stack Trace</h4>
                    <div className="bg-red-50 p-3 rounded-md text-xs text-red-800 overflow-x-auto">
                      <pre>{selectedCronLog.stackTrace}</pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setSelectedCronLog(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Modal */}
      <ClearLogsModal
        isOpen={showClearLogsModal}
        onClose={() => setShowClearLogsModal(false)}
        onClearComplete={() => {
          fetchCronJobLogs();
          fetchLogs();
          fetchCronStatus();
        }}
      />
    </div>
  );
};

export default ApiMonitorClient;
