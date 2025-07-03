// Superadmin Auto Price System Monitor
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProxyStats {
  totalProxies: number;
  workingProxies: number;
  lastRefresh: string | null;
  currentProxyIndex: number;
  requestsToday: number;
  successRate: number;
}

interface ScrapingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsLast24h: number;
  successRateToday: number;
}

interface RequestLog {
  id: string;
  url: string;
  proxyId: string;
  proxyAddress: string;
  success: boolean;
  responseTime: number;
  statusCode: number;
  error: string | null;
  timestamp: string;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  lastCheck: string;
  uptime: number;
}

export default function AutoPriceSystemMonitor() {
  const [proxyStats, setProxyStats] = useState<ProxyStats | null>(null);
  const [scrapingStats, setScrapingStats] = useState<ScrapingStats | null>(null);
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch proxy stats
      const proxyResponse = await fetch('/api/superadmin/webshare-request?action=proxy-stats');
      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        setProxyStats(proxyData.data);
      }

      // Fetch request logs
      const logsResponse = await fetch('/api/superadmin/webshare-request?action=request-logs&limit=50');
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setRequestLogs(logsData.data.logs || []);
      }

      // Calculate scraping stats from logs
      if (requestLogs.length > 0) {
        const successful = requestLogs.filter(log => log.success).length;
        const avgResponseTime = requestLogs.reduce((sum, log) => sum + log.responseTime, 0) / requestLogs.length;
        
        setScrapingStats({
          totalRequests: requestLogs.length,
          successfulRequests: successful,
          failedRequests: requestLogs.length - successful,
          averageResponseTime: Math.round(avgResponseTime),
          requestsLast24h: requestLogs.filter(log => 
            new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length,
          successRateToday: requestLogs.length > 0 ? Math.round((successful / requestLogs.length) * 100) : 0
        });
      }

      // Determine system health
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (!proxyStats || proxyStats.totalProxies === 0) {
        issues.push('No proxies available');
        status = 'critical';
      } else if (proxyStats.workingProxies < proxyStats.totalProxies * 0.5) {
        issues.push('Low proxy availability');
        status = 'warning';
      }

      if (scrapingStats && scrapingStats.successRateToday < 70) {
        issues.push('Low scraping success rate');
        status = status === 'critical' ? 'critical' : 'warning';
      }

      setSystemHealth({
        status,
        issues,
        lastCheck: new Date().toISOString(),
        uptime: Date.now() // Simplified uptime
      });

    } catch (error) {
      console.error('Error fetching Auto Price monitor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProxies = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/superadmin/webshare-request?action=refresh-proxies');
      if (response.ok) {
        await fetchData(); // Refresh data after proxy refresh
      }
    } catch (error) {
      console.error('Error refreshing proxies:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Auto Price System Monitor</h2>
        <div className="flex space-x-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            Refresh Data
          </Button>
          <Button 
            onClick={refreshProxies} 
            variant="outline" 
            size="sm"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Proxies'}
          </Button>
        </div>
      </div>

      {/* System Health */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>System Health</span>
              <Badge 
                className={`${getStatusColor(systemHealth.status)} text-white`}
              >
                {systemHealth.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systemHealth.issues.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-red-600 font-medium">Issues detected:</p>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {systemHealth.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-green-600">All systems operational</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Last checked: {new Date(systemHealth.lastCheck).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Proxy Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Proxy Status</CardTitle>
          </CardHeader>
          <CardContent>
            {proxyStats ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Proxies:</span>
                  <span className="font-medium">{proxyStats.totalProxies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Working:</span>
                  <span className="font-medium text-green-600">{proxyStats.workingProxies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Success Rate:</span>
                  <span className="font-medium">{proxyStats.successRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Requests Today:</span>
                  <span className="font-medium">{proxyStats.requestsToday}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No proxy data available</p>
            )}
          </CardContent>
        </Card>

        {/* Scraping Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Scraping Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {scrapingStats ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Requests:</span>
                  <span className="font-medium">{scrapingStats.totalRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Success Rate:</span>
                  <span className="font-medium text-green-600">{scrapingStats.successRateToday}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Response:</span>
                  <span className="font-medium">{formatDuration(scrapingStats.averageResponseTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Last 24h:</span>
                  <span className="font-medium">{scrapingStats.requestsLast24h}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No scraping data available</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                className="w-full" 
                size="sm" 
                variant="outline"
                onClick={() => window.open('/admin/auto-price', '_blank')}
              >
                Open Auto Price Dashboard
              </Button>
              <Button 
                className="w-full" 
                size="sm" 
                variant="outline"
                onClick={() => window.open('/superadmin/webshare', '_blank')}
              >
                Manage Webshare Settings
              </Button>
              <Button 
                className="w-full" 
                size="sm" 
                variant="outline"
                onClick={fetchData}
              >
                Run System Health Check
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs">Recent Logs</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent Request Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">URL</th>
                      <th className="text-left p-2">Proxy</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestLogs.slice(0, 10).map((log) => (
                      <tr key={log.id} className="border-b">
                        <td className="p-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-2 truncate max-w-xs">
                          {log.url}
                        </td>
                        <td className="p-2">
                          {log.proxyAddress}
                        </td>
                        <td className="p-2">
                          <Badge 
                            className={log.success ? 'bg-green-500' : 'bg-red-500'}
                          >
                            {log.success ? 'Success' : 'Failed'}
                          </Badge>
                        </td>
                        <td className="p-2">
                          {formatDuration(log.responseTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Performance charts and detailed metrics will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Auto Price Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                System configuration options will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
