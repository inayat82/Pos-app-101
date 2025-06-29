import React, { useState, useEffect } from 'react';
import { 
  FiClock, 
  FiUser, 
  FiActivity, 
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiCalendar,
  FiAlertCircle
} from 'react-icons/fi';
import { db } from '@/lib/firebase/firebase';
import { 
  collection, 
  query, 
  orderBy,
  limit,
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';

interface ActivityLog {
  id: string;
  action: string;
  userEmail: string;
  userRole: string;
  timestamp: Timestamp;
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

const ActivityLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    fetchLogs();
  }, [filter, dateRange]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date filter
      const now = new Date();
      let startDate = new Date();
      switch (dateRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      let q = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      if (filter !== 'all') {
        q = query(
          collection(db, 'activityLogs'),
          where('action', '==', filter),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      }

      const querySnapshot = await getDocs(q);
      const logsData: ActivityLog[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logsData.push({
          id: doc.id,
          action: data.action || 'Unknown',
          userEmail: data.userEmail || 'Unknown',
          userRole: data.userRole || 'Unknown',
          timestamp: data.timestamp || Timestamp.now(),
          details: data.details || '',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent
        });
      });
      
      setLogs(logsData);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return 'text-green-600 bg-green-100';
      case 'logout':
        return 'text-gray-600 bg-gray-100';
      case 'create':
        return 'text-blue-600 bg-blue-100';
      case 'update':
        return 'text-yellow-600 bg-yellow-100';
      case 'delete':
        return 'text-red-600 bg-red-100';
      case 'error':
        return 'text-red-700 bg-red-200';
      default:
        return 'text-purple-600 bg-purple-100';
    }
  };

  const formatTimestamp = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading activity logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FiActivity className="h-6 w-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-semibold text-gray-800">Activity Logs</h2>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center">
          <FiSearch className="h-4 w-4 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center">
          <FiFilter className="h-4 w-4 text-gray-400 mr-2" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Actions</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="error">Errors</option>
          </select>
        </div>

        <div className="flex items-center">
          <FiCalendar className="h-4 w-4 text-gray-400 mr-2" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
          <FiAlertCircle className="h-5 w-5 text-red-600 mr-3" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No activity logs found
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <FiClock className="h-4 w-4 text-gray-400 mr-2" />
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <FiUser className="h-4 w-4 text-gray-400 mr-2" />
                      {log.userEmail}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.userRole}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {log.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination could be added here */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
        <div className="text-xs text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogsViewer;
