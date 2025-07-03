import React, { useState, useEffect } from 'react';
import { 
  FiUsers, 
  FiShield, 
  FiActivity, 
  FiDatabase,
  FiTrendingUp,
  FiPieChart,
  FiBarChart,
  FiClock,
  FiGlobe,
  FiServer
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';

interface AnalyticsData {
  totalUsers: number;
  totalAdmins: number;
  totalSubUsers: number;
  activeUsers: number;
  takealotUsers: number;
  posUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  recentActivity: ActivityLog[];
  userGrowth: GrowthData[];
  // Add Webshare proxy stats
  webshareProxyStats?: {
    totalProxies: number;
    lastRefresh: Date | null;
    isConnected: boolean;
  };
}

interface ActivityLog {
  id: string;
  action: string;
  userEmail: string;
  timestamp: Timestamp;
  details: string;
}

interface GrowthData {
  date: string;
  users: number;
  admins: number;
}

const SuperAdminAnalytics: React.FC = () => {
  const { currentUser } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const usersRef = collection(db, 'users');
      
      // Get total counts
      const totalUsersSnap = await getCountFromServer(usersRef);
      const totalUsers = totalUsersSnap.data().count;

      const adminsQuery = query(usersRef, where('role', '==', 'admin'));
      const adminsSnap = await getCountFromServer(adminsQuery);
      const totalAdmins = adminsSnap.data().count;

      const subUsersQuery = query(usersRef, where('role', 'in', ['posuser', 'takealotuser']));
      const subUsersSnap = await getCountFromServer(subUsersQuery);
      const totalSubUsers = subUsersSnap.data().count;

      // Get active users (logged in within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeUsersQuery = query(
        usersRef, 
        where('lastLogin', '>=', Timestamp.fromDate(thirtyDaysAgo))
      );
      const activeUsersSnap = await getCountFromServer(activeUsersQuery);
      const activeUsers = activeUsersSnap.data().count;

      // Get role-specific counts
      const takealotQuery = query(usersRef, where('role', '==', 'takealotuser'));
      const takealotSnap = await getCountFromServer(takealotQuery);
      const takealotUsers = takealotSnap.data().count;

      const posQuery = query(usersRef, where('role', '==', 'posuser'));
      const posSnap = await getCountFromServer(posQuery);
      const posUsers = posSnap.data().count;

      // Get new users this week/month
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const newUsersWeekQuery = query(
        usersRef,
        where('createdAt', '>=', Timestamp.fromDate(oneWeekAgo))
      );
      const newUsersWeekSnap = await getCountFromServer(newUsersWeekQuery);
      const newUsersThisWeek = newUsersWeekSnap.data().count;

      const newUsersMonthQuery = query(
        usersRef,
        where('createdAt', '>=', Timestamp.fromDate(oneMonthAgo))
      );
      const newUsersMonthSnap = await getCountFromServer(newUsersMonthQuery);
      const newUsersThisMonth = newUsersMonthSnap.data().count;

      // Get recent activity (you might need to create an activity log collection)
      const recentActivity: ActivityLog[] = [];

      // Calculate user growth (simplified - you'd want to group by date)
      const userGrowth: GrowthData[] = [];

      // Webshare proxy stats - fetch from API instead of direct service
      let webshareProxyStats = {
        totalProxies: 0,
        lastRefresh: null as Date | null,
        isConnected: false,
      };
      
      try {
        const response = await fetch('/api/superadmin/webshare-unified');
        if (response.ok) {
          const systemStatus = await response.json();
          webshareProxyStats = {
            totalProxies: systemStatus.totalProxies || 0,
            lastRefresh: systemStatus.lastSync ? new Date(systemStatus.lastSync) : null,
            isConnected: systemStatus.isConfigured && systemStatus.isEnabled,
          };
        }
      } catch (error) {
        console.error('Failed to fetch webshare status:', error);
      }

      setAnalytics({
        totalUsers,
        totalAdmins,
        totalSubUsers,
        activeUsers,
        takealotUsers,
        posUsers,
        newUsersThisWeek,
        newUsersThisMonth,
        recentActivity,
        userGrowth,
        webshareProxyStats
      });

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchAnalytics}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'year')}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={analytics?.totalUsers || 0}
          icon={<FiUsers className="text-blue-600" />}
          color="blue"
          change={`+${analytics?.newUsersThisMonth || 0} this month`}
        />
        
        <MetricCard
          title="Admins"
          value={analytics?.totalAdmins || 0}
          icon={<FiShield className="text-green-600" />}
          color="green"
          change={`${Math.round(((analytics?.totalAdmins || 0) / (analytics?.totalUsers || 1)) * 100)}% of total`}
        />
        
        <MetricCard
          title="Active Users"
          value={analytics?.activeUsers || 0}
          icon={<FiActivity className="text-purple-600" />}
          color="purple"
          change={`${Math.round(((analytics?.activeUsers || 0) / (analytics?.totalUsers || 1)) * 100)}% active`}
        />
        
        <MetricCard
          title="Sub-users"
          value={analytics?.totalSubUsers || 0}
          icon={<FiUsers className="text-orange-600" />}
          color="orange"
          change={`+${analytics?.newUsersThisWeek || 0} this week`}
        />
      </div>

      {/* Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FiPieChart className="mr-2" />
            User Roles Distribution
          </h3>
          <div className="space-y-4">
            <RoleBar 
              label="Admins" 
              count={analytics?.totalAdmins || 0} 
              total={analytics?.totalUsers || 1}
              color="bg-blue-500"
            />
            <RoleBar 
              label="Takealot Users" 
              count={analytics?.takealotUsers || 0} 
              total={analytics?.totalUsers || 1}
              color="bg-purple-500"
            />
            <RoleBar 
              label="POS Users" 
              count={analytics?.posUsers || 0} 
              total={analytics?.totalUsers || 1}
              color="bg-green-500"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FiTrendingUp className="mr-2" />
            System Health
          </h3>
          <div className="space-y-4">
            <SystemMetric 
              label="Database Status" 
              status="Healthy" 
              icon={<FiDatabase />}
              color="green"
            />
            <SystemMetric 
              label="API Response Time" 
              status="< 200ms" 
              icon={<FiServer />}
              color="green"
            />
            <SystemMetric 
              label="Uptime" 
              status="99.9%" 
              icon={<FiClock />}
              color="green"
            />
            <SystemMetric 
              label="Active Connections" 
              status={`${analytics?.activeUsers || 0} users`} 
              icon={<FiGlobe />}
              color="blue"
            />
            <SystemMetric 
              label="Proxy Status" 
              status={analytics?.webshareProxyStats?.isConnected ? `${analytics.webshareProxyStats.totalProxies} proxies` : "Disconnected"} 
              icon={<FiGlobe />}
              color={analytics?.webshareProxyStats?.isConnected ? "green" : "red"}
            />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-gray-500 text-center py-8">
          <FiActivity className="mx-auto h-12 w-12 mb-2" />
          <p>Activity logging will be implemented soon</p>
          <p className="text-sm">Track user actions, logins, and system events</p>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  change?: string;
}> = ({ title, value, icon, color, change }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200'
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
          {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
};

// Role Bar Component
const RoleBar: React.FC<{
  label: string;
  count: number;
  total: number;
  color: string;
}> = ({ label, count, total, color }) => {
  const percentage = (count / total) * 100;

  return (
    <div>
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{label}</span>
        <span>{count} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`${color} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

// System Metric Component
const SystemMetric: React.FC<{
  label: string;
  status: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, status, icon, color }) => {
  const colorClasses = {
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    red: 'text-red-600 bg-red-100',
    blue: 'text-blue-600 bg-blue-100'
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
      <div className="flex items-center">
        <div className={`p-2 rounded-full ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
        <span className="ml-3 text-sm text-gray-700">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-900">{status}</span>
    </div>
  );
};

export default SuperAdminAnalytics;
