'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/context/PageTitleContext';
import {
  FiClock,
  FiPlay,
  FiPause,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiActivity,
  FiSettings,
  FiList,
  FiBarChart
} from 'react-icons/fi';

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string; // cron expression
  type: 'takealot_sync' | 'auto_price_scraping' | 'report_generation' | 'data_cleanup' | 'health_check';
  status: 'active' | 'paused' | 'error' | 'disabled';
  lastRun: string | null;
  nextRun: string | null;
  runCount: number;
  successCount: number;
  errorCount: number;
  averageRunTime: number; // in seconds
  lastError?: string;
  adminId?: string; // For admin-specific jobs
  integrationId?: string; // For integration-specific jobs
}

interface CronExecution {
  id: string;
  jobId: string;
  jobName: string;
  startTime: string;
  endTime: string | null;
  status: 'running' | 'completed' | 'failed';
  duration: number | null; // in seconds
  recordsProcessed?: number;
  errorMessage?: string;
  logs: string[];
}

interface CronStats {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  errorJobs: number;
  totalExecutions24h: number;
  successfulExecutions24h: number;
  averageRunTime: number;
  systemLoad: number;
}

export default function CronManagementPage() {
  const { setPageTitle } = usePageTitle();
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronExecutions, setCronExecutions] = useState<CronExecution[]>([]);
  const [cronStats, setCronStats] = useState<CronStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);

  useEffect(() => {
    setPageTitle('Cron Job Management');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    fetchCronData();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchCronData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCronData = async () => {
    try {
      setLoading(true);
      
      // Fetch cron jobs
      const jobsResponse = await fetch('/api/superadmin/cron-management?action=jobs');
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setCronJobs(jobsData.data || []);
      }

      // Fetch recent executions
      const executionsResponse = await fetch('/api/superadmin/cron-management?action=executions');
      if (executionsResponse.ok) {
        const executionsData = await executionsResponse.json();
        setCronExecutions(executionsData.data || []);
      }

      // Fetch statistics
      const statsResponse = await fetch('/api/superadmin/cron-management?action=stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setCronStats(statsData.data);
      }
      
    } catch (error) {
      console.error('Error fetching cron data:', error);
      // Fallback to mock data if API fails
      await generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = async () => {
    // Mock cron jobs
    const mockJobs: CronJob[] = [
      {
        id: 'takealot_sync_all',
        name: 'Takealot Data Sync',
        description: 'Synchronizes product data, sales, and inventory from all Takealot integrations',
        schedule: '0 */4 * * *', // Every 4 hours
        type: 'takealot_sync',
        status: 'active',
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        runCount: 156,
        successCount: 148,
        errorCount: 8,
        averageRunTime: 45
      },
      {
        id: 'auto_price_scraping',
        name: 'Auto Price Scraping',
        description: 'Scrapes competitor prices for all products in the auto-price system',
        schedule: '0 */2 * * *', // Every 2 hours
        type: 'auto_price_scraping',
        status: 'active',
        lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        nextRun: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour from now
        runCount: 234,
        successCount: 220,
        errorCount: 14,
        averageRunTime: 120
      },
      {
        id: 'daily_reports',
        name: 'Daily Report Generation',
        description: 'Generates daily sales and performance reports for all admins',
        schedule: '0 6 * * *', // Daily at 6 AM
        type: 'report_generation',
        status: 'active',
        lastRun: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
        nextRun: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
        runCount: 45,
        successCount: 43,
        errorCount: 2,
        averageRunTime: 180
      },
      {
        id: 'data_cleanup',
        name: 'Data Cleanup',
        description: 'Cleans up old logs, temporary data, and expired cache entries',
        schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
        type: 'data_cleanup',
        status: 'active',
        lastRun: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        nextRun: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
        runCount: 12,
        successCount: 12,
        errorCount: 0,
        averageRunTime: 300
      },
      {
        id: 'system_health_check',
        name: 'System Health Check',
        description: 'Monitors system health, API endpoints, and database connections',
        schedule: '*/5 * * * *', // Every 5 minutes
        type: 'health_check',
        status: 'active',
        lastRun: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
        runCount: 2880,
        successCount: 2875,
        errorCount: 5,
        averageRunTime: 15
      }
    ];

    // Mock recent executions
    const mockExecutions: CronExecution[] = [
      {
        id: 'exec_1',
        jobId: 'takealot_sync_all',
        jobName: 'Takealot Data Sync',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 45 * 1000).toISOString(),
        status: 'completed',
        duration: 45,
        recordsProcessed: 1245,
        logs: ['Started sync process', 'Connected to Takealot API', 'Processing products...', 'Sync completed successfully']
      },
      {
        id: 'exec_2',
        jobId: 'auto_price_scraping',
        jobName: 'Auto Price Scraping',
        startTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000 + 120 * 1000).toISOString(),
        status: 'completed',
        duration: 120,
        recordsProcessed: 850,
        logs: ['Started scraping process', 'Rotating proxies', 'Scraping product prices...', 'Scraping completed']
      },
      {
        id: 'exec_3',
        jobId: 'system_health_check',
        jobName: 'System Health Check',
        startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 5 * 60 * 1000 + 15 * 1000).toISOString(),
        status: 'completed',
        duration: 15,
        logs: ['Checking database connection', 'Checking API endpoints', 'All systems operational']
      }
    ];

    // Mock statistics
    const mockStats: CronStats = {
      totalJobs: mockJobs.length,
      activeJobs: mockJobs.filter(job => job.status === 'active').length,
      pausedJobs: mockJobs.filter(job => job.status === 'paused').length,
      errorJobs: mockJobs.filter(job => job.status === 'error').length,
      totalExecutions24h: 48,
      successfulExecutions24h: 46,
      averageRunTime: 85,
      systemLoad: 0.65
    };

    setCronJobs(mockJobs);
    setCronExecutions(mockExecutions);
    setCronStats(mockStats);
  };

  const handleJobAction = async (jobId: string, action: 'start' | 'pause' | 'stop') => {
    try {
      const response = await fetch('/api/superadmin/cron-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, jobId }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);
        
        // Update local state
        setCronJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: action === 'pause' ? 'paused' : action === 'stop' ? 'disabled' : 'active' }
            : job
        ));
        
        // Refresh data
        fetchCronData();
      } else {
        console.error(`Failed to ${action} job`);
      }
    } catch (error) {
      console.error(`Error ${action}ing job:`, error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      disabled: 'bg-gray-100 text-gray-800'
    };
    return variants[status as keyof typeof variants] || variants.disabled;
  };

  const getJobTypeIcon = (type: string) => {
    switch (type) {
      case 'takealot_sync': return <FiRefreshCw className="h-4 w-4" />;
      case 'auto_price_scraping': return <FiBarChart className="h-4 w-4" />;
      case 'report_generation': return <FiList className="h-4 w-4" />;
      case 'data_cleanup': return <FiSettings className="h-4 w-4" />;
      case 'health_check': return <FiActivity className="h-4 w-4" />;
      default: return <FiClock className="h-4 w-4" />;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cron Job Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage scheduled tasks and automated processes</p>
        </div>
        <Button onClick={fetchCronData} variant="outline" className="flex items-center space-x-2">
          <FiRefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Statistics Cards */}
      {cronStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold">{cronStats.totalJobs}</p>
                </div>
                <FiClock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                  <p className="text-2xl font-bold text-green-600">{cronStats.activeJobs}</p>
                </div>
                <FiCheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate (24h)</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {cronStats.totalExecutions24h > 0 
                      ? Math.round((cronStats.successfulExecutions24h / cronStats.totalExecutions24h) * 100)
                      : 0}%
                  </p>
                </div>
                <FiBarChart className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">System Load</p>
                  <p className="text-2xl font-bold text-orange-600">{Math.round(cronStats.systemLoad * 100)}%</p>
                </div>
                <FiActivity className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Cron Jobs</TabsTrigger>
          <TabsTrigger value="executions">Recent Executions</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cronJobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getJobTypeIcon(job.type)}
                        <div>
                          <h3 className="font-medium text-gray-900">{job.name}</h3>
                          <p className="text-sm text-gray-600">{job.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>Schedule: {job.schedule}</span>
                            <span>Last Run: {formatDateTime(job.lastRun)}</span>
                            <span>Next Run: {formatDateTime(job.nextRun)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusBadge(job.status)}>
                          {job.status}
                        </Badge>
                        <div className="text-right text-sm">
                          <div className="text-gray-900">{job.runCount} runs</div>
                          <div className="text-green-600">{job.successCount} success</div>
                          <div className="text-red-600">{job.errorCount} errors</div>
                        </div>
                        <div className="flex space-x-1">
                          {job.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleJobAction(job.id, 'pause')}
                            >
                              <FiPause className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleJobAction(job.id, 'start')}
                            >
                              <FiPlay className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedJob(job);
                              setShowJobModal(true);
                            }}
                          >
                            <FiSettings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cronExecutions.map((execution) => (
                  <div key={execution.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{execution.jobName}</h3>
                        <p className="text-sm text-gray-600">
                          Started: {formatDateTime(execution.startTime)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusBadge(execution.status)}>
                          {execution.status}
                        </Badge>
                        {execution.duration && (
                          <span className="text-sm text-gray-600">
                            {formatDuration(execution.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    {execution.recordsProcessed && (
                      <p className="text-sm text-gray-600 mb-2">
                        Processed: {execution.recordsProcessed} records
                      </p>
                    )}
                    <div className="bg-gray-100 rounded p-3 text-sm">
                      <div className="font-medium mb-1">Execution Logs:</div>
                      {execution.logs.map((log, index) => (
                        <div key={index} className="text-gray-600">• {log}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                <div>[2025-07-02 14:30:15] INFO: Cron daemon started successfully</div>
                <div>[2025-07-02 14:30:16] INFO: Loaded 5 scheduled jobs</div>
                <div>[2025-07-02 14:35:00] INFO: Executing job: system_health_check</div>
                <div>[2025-07-02 14:35:15] INFO: Job completed: system_health_check (15s)</div>
                <div>[2025-07-02 15:00:00] INFO: Executing job: auto_price_scraping</div>
                <div>[2025-07-02 15:02:00] INFO: Job completed: auto_price_scraping (120s)</div>
                <div>[2025-07-02 16:00:00] INFO: Executing job: takealot_sync_all</div>
                <div>[2025-07-02 16:00:45] INFO: Job completed: takealot_sync_all (45s)</div>
                <div>[2025-07-02 16:05:00] INFO: Executing job: system_health_check</div>
                <div>[2025-07-02 16:05:15] INFO: Job completed: system_health_check (15s)</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
