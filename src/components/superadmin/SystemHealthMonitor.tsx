import React, { useState, useEffect } from 'react';
import { 
  FiServer, 
  FiDatabase, 
  FiWifi,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiClock,
  FiActivity,
  FiGlobe
} from 'react-icons/fi';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  lastChecked: Date;
  message: string;
}

interface SystemMetrics {
  uptime: string;
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
  activeUsers: number;
}

const SystemHealthMonitor: React.FC = () => {
  const [healthStatuses, setHealthStatuses] = useState<HealthStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      setLoading(true);
      
      // Check various system endpoints
      const services = [
        { name: 'API Health', endpoint: '/api/health' },
        { name: 'Firebase Connection', endpoint: '/api/test-firebase' },
        { name: 'Takealot Sync', endpoint: '/api/takealot/health' },
        { name: 'Authentication', endpoint: '/api/auth/health' },
        { name: 'Database', endpoint: '/api/db/health' }
      ];

      const healthChecks = await Promise.allSettled(
        services.map(async (service) => {
          const startTime = Date.now();
          try {
            const response = await fetch(service.endpoint);
            const responseTime = Date.now() - startTime;
            
            return {
              service: service.name,
              status: response.ok ? 'healthy' as const : 'error' as const,
              responseTime,
              lastChecked: new Date(),
              message: response.ok ? 'Service is operational' : `HTTP ${response.status}`
            };
          } catch (error) {
            return {
              service: service.name,
              status: 'error' as const,
              responseTime: Date.now() - startTime,
              lastChecked: new Date(),
              message: 'Service unavailable'
            };
          }
        })
      );

      const statuses: HealthStatus[] = healthChecks.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            service: services[index].name,
            status: 'error' as const,
            responseTime: 0,
            lastChecked: new Date(),
            message: 'Health check failed'
          };
        }
      });

      setHealthStatuses(statuses);

      // Mock system metrics (in a real app, these would come from your monitoring system)
      const mockMetrics: SystemMetrics = {
        uptime: calculateUptime(),
        totalRequests: Math.floor(Math.random() * 10000) + 50000,
        errorRate: Math.random() * 5, // 0-5% error rate
        avgResponseTime: Math.floor(Math.random() * 200) + 100, // 100-300ms
        activeUsers: Math.floor(Math.random() * 100) + 50
      };

      setMetrics(mockMetrics);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error checking system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUptime = (): string => {
    // Mock uptime calculation - in a real app, this would be actual uptime
    const days = Math.floor(Math.random() * 30) + 1;
    const hours = Math.floor(Math.random() * 24);
    const minutes = Math.floor(Math.random() * 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <FiCheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <FiAlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <FiXCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FiActivity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const overallHealth = healthStatuses.length > 0 ? 
    healthStatuses.every(s => s.status === 'healthy') ? 'healthy' :
    healthStatuses.some(s => s.status === 'error') ? 'error' : 'warning'
    : 'warning';

  return (
    <div className="space-y-6">
      {/* Overall System Status */}
      <div className={`p-6 rounded-xl border-2 ${getStatusColor(overallHealth)}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            {getStatusIcon(overallHealth)}
            <h2 className="ml-3 text-xl font-semibold text-gray-800">
              System Status: {overallHealth === 'healthy' ? 'All Systems Operational' : 
                            overallHealth === 'warning' ? 'Some Issues Detected' : 'Critical Issues'}
            </h2>
          </div>
          <button
            onClick={checkSystemHealth}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.uptime}</p>
              </div>
              <FiClock className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalRequests.toLocaleString()}</p>
              </div>
              <FiActivity className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Error Rate</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.errorRate.toFixed(2)}%</p>
              </div>
              <FiAlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.avgResponseTime}ms</p>
              </div>
              <FiServer className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activeUsers}</p>
              </div>
              <FiGlobe className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
        </div>
      )}

      {/* Service Health Details */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Service Health Details</h3>
        <div className="space-y-3">
          {healthStatuses.map((status, index) => (
            <div key={index} className={`p-4 rounded-lg border ${getStatusColor(status.status)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getStatusIcon(status.status)}
                  <div className="ml-3">
                    <h4 className="font-medium text-gray-900">{status.service}</h4>
                    <p className="text-sm text-gray-600">{status.message}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{status.responseTime}ms</p>
                  <p className="text-xs text-gray-500">
                    {status.lastChecked.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemHealthMonitor;
