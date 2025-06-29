import React, { useState, useEffect } from 'react';
import { 
  FiGlobe, 
  FiServer,
  FiActivity,
  FiRefreshCw,
  FiDownload,
  FiSettings,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiBarChart,
  FiMap,
  FiClock,
  FiShield
} from 'react-icons/fi';
import { WebshareProxy, ProxyUsageStats } from '@/types/webshare';
import WebshareProxyService from '@/lib/services/webshareProxyService';

const WebshareProxyManager: React.FC = () => {
  const [proxyService] = useState(() => new WebshareProxyService());
  const [proxies, setProxies] = useState<WebshareProxy[]>([]);
  const [usageStats, setUsageStats] = useState<ProxyUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'proxies' | 'stats' | 'settings'>('overview');
  const [filterCountry, setFilterCountry] = useState('');
  const [proxyStatus, setProxyStatus] = useState<'all' | 'active' | 'inactive' | 'failed'>('all');

  useEffect(() => {
    // Load saved API token from localStorage
    const savedToken = localStorage.getItem('webshare_api_token');
    if (savedToken) {
      setApiToken(savedToken);
      proxyService.setApiToken(savedToken);
      fetchProxies();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProxies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const fetchedProxies = await proxyService.fetchProxies();
      const stats = proxyService.getUsageStats();
      
      setProxies(fetchedProxies);
      setUsageStats(stats);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch proxies');
    } finally {
      setLoading(false);
    }
  };

  const saveApiToken = () => {
    if (!apiToken.trim()) {
      setError('Please enter a valid API token');
      return;
    }

    localStorage.setItem('webshare_api_token', apiToken);
    proxyService.setApiToken(apiToken);
    setIsConfiguring(false);
    fetchProxies();
  };

  const exportProxies = (format: 'json' | 'txt' | 'csv') => {
    const data = proxyService.exportProxies(format);
    const blob = new Blob([data], { 
      type: format === 'json' ? 'application/json' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webshare-proxies.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'blocked': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredProxies = proxies.filter(proxy => {
    const matchesCountry = !filterCountry || proxy.country_code.toLowerCase().includes(filterCountry.toLowerCase());
    const stats = usageStats.find(s => s.proxy_id === proxy.id);
    const matchesStatus = proxyStatus === 'all' || (stats && stats.status === proxyStatus);
    
    return matchesCountry && matchesStatus;
  });

  const statsSummary = proxyService.getStatsSummary();
  const countries = [...new Set(proxies.map(p => p.country_code))].sort();

  if (loading && proxies.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading proxy data...</span>
        </div>
      </div>
    );
  }

  if (!apiToken && !isConfiguring) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center">
          <FiShield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Configure Webshare API</h3>
          <p className="text-gray-600 mb-6">
            Enter your Webshare API token to manage your 500 proxy IPs for Takealot API requests.
          </p>
          <button
            onClick={() => setIsConfiguring(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Configure API Token
          </button>
        </div>
      </div>
    );
  }

  if (isConfiguring) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Webshare API Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Token
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Enter your Webshare API token"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can create API tokens in your Webshare dashboard under API Keys section.
            </p>
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          <div className="flex space-x-3">
            <button
              onClick={saveApiToken}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Configuration
            </button>
            <button
              onClick={() => setIsConfiguring(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <FiGlobe className="h-6 w-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-semibold text-gray-800">Webshare Proxy Manager</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchProxies}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsConfiguring(true)}
            className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <FiSettings className="h-4 w-4 mr-2" />
            Settings
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <FiAlertTriangle className="h-5 w-5 text-red-600 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: FiBarChart },
            { id: 'proxies', label: 'Proxy List', icon: FiServer },
            { id: 'stats', label: 'Statistics', icon: FiActivity },
            { id: 'settings', label: 'Takealot Config', icon: FiSettings },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <FiServer className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Proxies</p>
                  <p className="text-2xl font-bold text-gray-900">{statsSummary.totalProxies}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <FiActivity className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Proxies</p>
                  <p className="text-2xl font-bold text-gray-900">{statsSummary.activeProxies}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <FiBarChart className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{statsSummary.successRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <FiClock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Response</p>
                  <p className="text-2xl font-bold text-gray-900">{statsSummary.avgResponseTime.toFixed(0)}ms</p>
                </div>
              </div>
            </div>
          </div>

          {/* Country Distribution */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FiMap className="mr-2" />
              Geographic Distribution
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statsSummary.topCountries.map((country, index) => (
                <div key={country.country} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{country.country}</span>
                  <span className="text-blue-600 font-bold">{country.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Proxy List Tab */}
      {activeTab === 'proxies' && (
        <div className="space-y-4">
          {/* Filters and Export */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Countries</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>

              <select
                value={proxyStatus}
                onChange={(e) => setProxyStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => exportProxies('json')}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiDownload className="h-4 w-4 mr-2" />
                JSON
              </button>
              <button
                onClick={() => exportProxies('txt')}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiDownload className="h-4 w-4 mr-2" />
                TXT
              </button>
              <button
                onClick={() => exportProxies('csv')}
                className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiDownload className="h-4 w-4 mr-2" />
                CSV
              </button>
            </div>
          </div>

          {/* Proxy Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proxy Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Used
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProxies.slice(0, 50).map((proxy) => {
                    const stats = usageStats.find(s => s.proxy_id === proxy.id);
                    return (
                      <tr key={proxy.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {proxy.proxy_address}:{proxy.port}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {proxy.city_name}, {proxy.country_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            proxy.is_valid ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'
                          }`}>
                            {proxy.is_valid ? 'Valid' : 'Invalid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats ? `${stats.requests_made} requests` : '0 requests'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stats?.last_activity ? new Date(stats.last_activity).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filteredProxies.length > 50 && (
            <div className="text-center py-4 text-gray-500">
              Showing first 50 of {filteredProxies.length} proxies
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Request Statistics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Requests:</span>
                  <span className="font-medium">{statsSummary.totalRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-medium text-green-600">{statsSummary.successRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Response Time:</span>
                  <span className="font-medium">{statsSummary.avgResponseTime.toFixed(0)}ms</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Proxy Health</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Active Proxies:</span>
                  <span className="font-medium text-green-600">{statsSummary.activeProxies}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Proxies:</span>
                  <span className="font-medium">{statsSummary.totalProxies}</span>
                </div>
                <div className="flex justify-between">
                  <span>Health Rate:</span>
                  <span className="font-medium">
                    {((statsSummary.activeProxies / statsSummary.totalProxies) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Takealot Configuration Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Takealot API Configuration</h3>
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex">
                <FiShield className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <h4 className="font-medium mb-1">Proxy Integration Ready</h4>
                  <p>Your Webshare proxies are configured and ready to be used with Takealot API requests. The system will automatically rotate through your 500 proxy IPs to avoid rate limiting and improve request success rates.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Rotation Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600">Strategy</label>
                    <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option>Round Robin</option>
                      <option>Random</option>
                      <option>Least Used</option>
                      <option>Geographic (SA Priority)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Rotation Interval</label>
                    <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option>Every Request</option>
                      <option>Every 5 Minutes</option>
                      <option>Every 15 Minutes</option>
                      <option>Every Hour</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-3">Request Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600">Max Retries</label>
                    <input 
                      type="number" 
                      defaultValue={3}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Timeout (seconds)</label>
                    <input 
                      type="number" 
                      defaultValue={30}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebshareProxyManager;
