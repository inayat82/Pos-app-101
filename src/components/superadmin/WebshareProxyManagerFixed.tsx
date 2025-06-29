'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiGlobe, 
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiDownload,
  FiSettings,
  FiEye,
  FiEyeOff,
  FiBarChart,
  FiMapPin,
  FiClock,
  FiServer,
  FiPieChart
} from 'react-icons/fi';

interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  country_code: string;
  city_name: string;
  created_at: string;
  last_verification: string;
  valid: boolean;
  asn_number?: string;
  asn_name?: string;
}

interface ProxyStats {
  total_proxies: number;
  valid_proxies: number;
  invalid_proxies: number;
  countries: string[];
  cities: string[];
  last_updated: string;
  success_rate: number;
  avg_creation_age_days: number;
  newest_proxy_date: string;
  oldest_proxy_date: string;
  country_distribution: { [key: string]: number };
  status_distribution: { valid: number; invalid: number };
}

interface WebshareUsageStats {
  timestamp: string;
  is_projected: boolean;
  bandwidth_total: number;
  bandwidth_average: number;
  requests_total: number;
  requests_successful: number;
  requests_failed: number;
  error_reasons: ErrorReason[];
  countries_used: { [key: string]: number };
  number_of_proxies_used: number;
  protocols_used: { [key: string]: number };
  average_concurrency: number;
  average_rps: number;
  last_request_sent_at: string;
}

interface ErrorReason {
  reason: string;
  type: string;
  how_to_fix: string;
  http_status: number;
  count: number;
}

interface WebshareProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  last_login: string;
  timezone: string;
}

interface WebshareSubscription {
  id: string;
  name: string;
  proxy_count: number;
  bandwidth_gb: number;
  expires_at: string;
  is_active: boolean;
  usage_bandwidth: number;
  usage_requests: number;
}

interface WebshareIPAuth {
  authorized_ips: string[];
  current_ip: string;
  is_authorized: boolean;
}

interface DashboardData {
  profile: WebshareProfile | null;
  subscription: WebshareSubscription | null;
  usageStats: WebshareUsageStats | null;
  ipAuth: WebshareIPAuth | null;
  errors: string[];
}

const WebshareProxyManagerFixed: React.FC = () => {
  const [apiToken, setApiToken] = useState('');
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [proxies, setProxies] = useState<WebshareProxy[]>([]);
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProxies, setTotalProxies] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'proxies' | 'analytics' | 'performance'>('overview');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Load saved API token on component mount and auto-load data if available
  useEffect(() => {
    const savedToken = localStorage.getItem('webshare_api_token');
    if (savedToken) {
      setApiToken(savedToken);
      setIsConnected(true);
      // Auto-load proxy data if token exists
      setTimeout(async () => {
        try {
          await loadProxies();
          await loadDashboardData();
        } catch (error) {
          console.log('Auto-load failed, user needs to test connection');
          setIsConnected(false);
        }
      }, 500);
    }
  }, []);

  const testConnection = async () => {
    if (!apiToken.trim()) {
      setError('Please enter an API token');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/superadmin/webshare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken: apiToken.trim(),
          action: 'test-connection'
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsConnected(true);
        setSuccess('Successfully connected to Webshare API!');
        localStorage.setItem('webshare_api_token', apiToken.trim());
        
        // Automatically load proxy data after successful connection
        setTimeout(async () => {
          await loadProxies();
          await loadDashboardData();
        }, 1000);
      } else {
        setError(result.error || 'Failed to connect to Webshare API');
        setIsConnected(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadProxies = async (page: number = 1) => {
    if (!apiToken.trim()) {
      setError('Please connect to Webshare API first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load current page of proxies
      const response = await fetch(`/api/superadmin/webshare?apiToken=${encodeURIComponent(apiToken.trim())}&action=list&page=${page}&page_size=50`);
      const result = await response.json();

      if (result.success) {
        const data = result.data;
        setProxies(data.results || []);
        setTotalProxies(data.count || 0);
        setTotalPages(Math.ceil((data.count || 0) / 50));
        setCurrentPage(page);
        
        // For comprehensive stats, we need to sample more data if this is the first load
        let allProxiesForStats = data.results || [];
        
        if (page === 1 && data.count > 50) {
          // Load additional pages for better stats (up to 200 proxies for stats calculation)
          const additionalPages = Math.min(3, Math.ceil(data.count / 50));
          const additionalPromises = [];
          
          for (let i = 2; i <= additionalPages; i++) {
            additionalPromises.push(
              fetch(`/api/superadmin/webshare?apiToken=${encodeURIComponent(apiToken.trim())}&action=list&page=${i}&page_size=50`)
                .then(res => res.json())
                .then(res => res.success ? res.data.results : [])
                .catch(() => [])
            );
          }
          
          const additionalResults = await Promise.all(additionalPromises);
          allProxiesForStats = [...allProxiesForStats, ...additionalResults.flat()];
        }
        
        // Calculate comprehensive stats from the sampled data
        const validProxies = allProxiesForStats.filter((p: WebshareProxy) => p.valid).length;
        const invalidProxies = allProxiesForStats.length - validProxies;
        const countries = [...new Set(allProxiesForStats.map((p: WebshareProxy) => p.country_code))] as string[];
        const cities = [...new Set(allProxiesForStats.map((p: WebshareProxy) => p.city_name))] as string[];
        
        // Calculate country distribution
        const countryDistribution: { [key: string]: number } = {};
        allProxiesForStats.forEach((p: WebshareProxy) => {
          countryDistribution[p.country_code] = (countryDistribution[p.country_code] || 0) + 1;
        });

        // Calculate creation dates for age analysis
        const creationDates = allProxiesForStats.map((p: WebshareProxy) => new Date(p.created_at));
        const now = new Date();
        const avgAge = creationDates.length > 0 
          ? creationDates.reduce((sum: number, date: Date) => sum + (now.getTime() - date.getTime()), 0) / creationDates.length / (1000 * 60 * 60 * 24)
          : 0;
        
        const newestDate = creationDates.length > 0 ? new Date(Math.max(...creationDates.map((d: Date) => d.getTime()))) : new Date();
        const oldestDate = creationDates.length > 0 ? new Date(Math.min(...creationDates.map((d: Date) => d.getTime()))) : new Date();
        
        // Scale the valid/invalid counts to represent the full dataset
        const scaleFactor = data.count / allProxiesForStats.length;
        const scaledValidProxies = Math.round(validProxies * scaleFactor);
        const scaledInvalidProxies = data.count - scaledValidProxies;
        
        setStats({
          total_proxies: data.count || 0,
          valid_proxies: scaledValidProxies,
          invalid_proxies: scaledInvalidProxies,
          countries,
          cities,
          last_updated: new Date().toISOString(),
          success_rate: data.count > 0 ? (scaledValidProxies / data.count) * 100 : 0,
          avg_creation_age_days: Math.round(avgAge),
          newest_proxy_date: newestDate.toISOString(),
          oldest_proxy_date: oldestDate.toISOString(),
          country_distribution: countryDistribution,
          status_distribution: { valid: scaledValidProxies, invalid: scaledInvalidProxies }
        });

        if (page === 1) {
          setSuccess(`Loaded ${allProxiesForStats.length} proxies for analysis from total of ${data.count || 0}. Displaying page 1.`);
        }
      } else {
        setError(result.error || 'Failed to load proxies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proxies');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (!apiToken.trim()) {
      setError('Please connect to Webshare API first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const days = timeRange === '24h' ? '1' : timeRange === '7d' ? '7' : '30';
      const response = await fetch(`/api/superadmin/webshare?apiToken=${encodeURIComponent(apiToken.trim())}&action=aggregate-stats&days=${days}`);
      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const downloadProxies = async () => {
    if (!apiToken.trim()) {
      setError('Please connect to Webshare API first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load all proxies for download
      let allProxies: WebshareProxy[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`/api/superadmin/webshare?apiToken=${encodeURIComponent(apiToken.trim())}&action=list&page=${page}&page_size=100`);
        const result = await response.json();

        if (result.success && result.data.results) {
          allProxies = [...allProxies, ...result.data.results];
          hasMore = !!result.data.next;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Create downloadable formats
      const formats = {
        json: JSON.stringify(allProxies, null, 2),
        txt: allProxies.map(p => `${p.proxy_address}:${p.port}:${p.username}:${p.password}`).join('\n'),
        csv: [
          'Address,Port,Username,Password,Country,City,Valid,Created',
          ...allProxies.map(p => 
            `${p.proxy_address},${p.port},${p.username},${p.password},${p.country_code},${p.city_name},${p.valid},${p.created_at}`
          )
        ].join('\n')
      };

      // Create download links
      Object.entries(formats).forEach(([format, content]) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webshare-proxies-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      setSuccess(`Downloaded ${allProxies.length} proxies in JSON, TXT, and CSV formats`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download proxies');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCountryFlag = (countryCode: string) => {
    const flags: { [key: string]: string } = {
      'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪',
      'FR': '🇫🇷', 'NL': '🇳🇱', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
      'ZA': '🇿🇦', 'BR': '🇧🇷', 'IN': '🇮🇳', 'IT': '🇮🇹', 'ES': '🇪🇸'
    };
    return flags[countryCode] || '🌍';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Enhanced Header with Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FiGlobe className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Webshare Proxy Analytics Dashboard</h2>
              <p className="text-sm text-gray-600">
                Comprehensive proxy management with usage analytics, performance metrics & account insights
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* API Token Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div className="md:col-span-2">
            <div className="relative">
              <input
                type={isTokenVisible ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Enter your Webshare API token"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={() => setIsTokenVisible(!isTokenVisible)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {isTokenVisible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>
          <button
            onClick={testConnection}
            disabled={loading || !apiToken.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center text-sm"
          >
            {loading ? <FiRefreshCw className="animate-spin mr-2" size={16} /> : <FiSettings className="mr-2" size={16} />}
            Test Connection
          </button>
          {isConnected && (
            <>
              <button
                onClick={() => {
                  loadProxies(1);
                  loadDashboardData();
                }}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center text-sm"
              >
                {loading ? <FiRefreshCw className="animate-spin mr-2" size={16} /> : <FiRefreshCw className="mr-2" size={16} />}
                Refresh All
              </button>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as '24h' | '7d' | '30d')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </>
          )}
        </div>

        {/* Navigation Tabs */}
        {isConnected && (
          <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg">
            {[
              { id: 'overview', label: 'Overview', icon: FiBarChart },
              { id: 'proxies', label: 'Proxy List', icon: FiServer },
              { id: 'analytics', label: 'Usage Analytics', icon: FiActivity },
              { id: 'performance', label: 'Performance', icon: FiPieChart }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
          <FiAlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center space-x-2">
          <FiCheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Tab Content */}
      {isConnected && renderTabContent()}

      {/* No Data State */}
      {!loading && !isConnected && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FiGlobe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect to Webshare</h3>
          <p className="text-gray-600 mb-4">
            Enter your Webshare API token above and test the connection to access comprehensive proxy analytics.
          </p>
          <a
            href="https://proxy.webshare.io/userapi/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiGlobe className="mr-2" />
            Get API Token
          </a>
        </div>
      )}
    </div>
  );

  // Helper function to render the current tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'proxies':
        return renderProxiesTab();
      case 'analytics':
        return renderAnalyticsTab();
      case 'performance':
        return renderPerformanceTab();
      default:
        return renderOverviewTab();
    }
  };

  const renderOverviewTab = () => {
    if (!dashboardData) {
      return <div className="text-center py-8 text-gray-500">Loading dashboard data...</div>;
    }

    const { profile, subscription, usageStats, ipAuth, errors } = dashboardData;

    const safeToLocaleString = (num: number | undefined | null) => {
      if (typeof num !== 'number') {
        return 'N/A';
      }
      return num.toLocaleString();
    };

    return (
      <div className="space-y-4">
        {errors && errors.length > 0 && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <p className="font-bold">API Errors:</p>
            <ul className="list-disc list-inside">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Account Info */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-gray-800 mb-2">Account</h3>
            {profile ? (
              <div className="text-sm space-y-1">
                <p><strong>Email:</strong> {profile.email}</p>
                <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
                <p><strong>Last Login:</strong> {profile.last_login ? formatDate(profile.last_login) : 'N/A'}</p>
              </div>
            ) : <p className="text-sm text-gray-500">Loading account info...</p>}
          </div>

          {/* Subscription */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-gray-800 mb-2">Subscription</h3>
            {subscription ? (
              <div className="text-sm space-y-1">
                <p><strong>Plan:</strong> {subscription.name}</p>
                <p><strong>Expires:</strong> {subscription.expires_at ? formatDate(subscription.expires_at) : 'N/A'}</p>
                <p><strong>Status:</strong> {subscription.is_active ? <span className="text-green-600">Active</span> : <span className="text-red-600">Inactive</span>}</p>
              </div>
            ) : <p className="text-sm text-gray-500">Loading subscription info...</p>}
          </div>

          {/* Usage (7d) */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-gray-800 mb-2">Usage ({timeRange === '7d' ? '7d' : timeRange === '24h' ? '24h' : '30d'})</h3>
            {usageStats ? (
              <div className="text-sm space-y-1">
                <p><strong>Bandwidth:</strong> {formatBytes(usageStats.bandwidth_total || 0)}</p>
                <p><strong>Requests:</strong> {safeToLocaleString(usageStats.requests_total)}</p>
              </div>
            ) : <p className="text-sm text-gray-500">Loading usage stats...</p>}
          </div>

          {/* IP Authorization */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-gray-800 mb-2">IP Authorization</h3>
            {ipAuth ? (
              <div className="text-sm space-y-1">
                <p><strong>Your IP:</strong> {ipAuth.current_ip}</p>
                <p><strong>Status:</strong> {ipAuth.is_authorized ? <span className="text-green-600">Authorized</span> : <span className="text-red-600">Not Authorized</span>}</p>
              </div>
            ) : <p className="text-sm text-gray-500">Loading IP auth info...</p>}
          </div>
        </div>
      </div>
    );
  };

  function renderProxiesTab() {
    return (
      <div className="space-y-4">
        {/* Proxy List Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Proxy List</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} ({totalProxies.toLocaleString()} total)
              </span>
              <button
                onClick={downloadProxies}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-md transition-colors flex items-center text-sm"
              >
                <FiDownload className="mr-2" size={16} />
                Export All
              </button>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mb-4">
              <button
                onClick={() => loadProxies(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                {currentPage}
              </span>
              <button
                onClick={() => loadProxies(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200 transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Proxy Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credentials
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ASN Info
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proxies.map((proxy) => (
                  <tr key={proxy.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {proxy.valid ? (
                          <FiCheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <FiXCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          proxy.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {proxy.valid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="mr-2">{getCountryFlag(proxy.country_code)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{proxy.country_code}</div>
                          <div className="text-xs text-gray-500">{proxy.city_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">
                        {proxy.proxy_address}:{proxy.port}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-600">
                        <div>{proxy.username}</div>
                        <div className="text-xs">****{proxy.password.slice(-4)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {proxy.asn_number && proxy.asn_name ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">ASN{proxy.asn_number}</div>
                          <div className="text-xs text-gray-500">{proxy.asn_name}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(proxy.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {proxies.length === 0 && !loading && (
            <div className="text-center py-8">
              <FiServer className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No proxies found</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderAnalyticsTab() {
    const usageStats = dashboardData?.usageStats;
    
    return (
      <div className="space-y-4">
        {/* Usage Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Total Bandwidth</h3>
              <FiActivity className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {usageStats ? formatBytes(usageStats.bandwidth_total) : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Avg: {usageStats ? formatBytes(usageStats.bandwidth_average) : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Total Requests</h3>
              <FiBarChart className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {usageStats ? usageStats.requests_total.toLocaleString() : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Success: {usageStats ? usageStats.requests_successful.toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Success Rate</h3>
              <FiCheckCircle className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {usageStats && usageStats.requests_total > 0 
                ? ((usageStats.requests_successful / usageStats.requests_total) * 100).toFixed(1) + '%'
                : 'N/A'
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Failed: {usageStats ? usageStats.requests_failed.toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Avg RPS</h3>
              <FiClock className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {usageStats ? usageStats.average_rps.toFixed(1) : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Concurrency: {usageStats ? usageStats.average_concurrency.toFixed(1) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Protocol & Country Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Protocol Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Protocol Usage</h3>
            {usageStats?.protocols_used ? (
              <div className="space-y-3">
                {Object.entries(usageStats.protocols_used).map(([protocol, count]) => (
                  <div key={protocol} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium uppercase">{protocol}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="bg-gray-200 rounded-full h-2 w-20">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(count / Math.max(...Object.values(usageStats.protocols_used))) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">{count.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No protocol data available</div>
            )}
          </div>

          {/* Country Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Country Usage</h3>
            {usageStats?.countries_used ? (
              <div className="space-y-3">
                {Object.entries(usageStats.countries_used)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{getCountryFlag(country)}</span>
                        <span className="text-sm font-medium">{country}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="bg-gray-200 rounded-full h-2 w-20">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ 
                              width: `${(count / Math.max(...Object.values(usageStats.countries_used))) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">{count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No country usage data available</div>
            )}
          </div>
        </div>

        {/* Usage Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Details ({timeRange})</h3>
          {usageStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Proxy Utilization</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Proxies Used:</span>
                    <span className="font-medium">{usageStats.number_of_proxies_used.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Concurrency:</span>
                    <span className="font-medium">{usageStats.average_concurrency.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Request:</span>
                    <span className="font-medium">{formatDate(usageStats.last_request_sent_at)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg RPS:</span>
                    <span className="font-medium">{usageStats.average_rps.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Bandwidth:</span>
                    <span className="font-medium">{formatBytes(usageStats.bandwidth_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Bandwidth:</span>
                    <span className="font-medium">{formatBytes(usageStats.bandwidth_average)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Data Quality</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Is Projected:</span>
                    <span className={`font-medium ${usageStats.is_projected ? 'text-yellow-600' : 'text-green-600'}`}>
                      {usageStats.is_projected ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Timestamp:</span>
                    <span className="font-medium">{formatDate(usageStats.timestamp)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time Range:</span>
                    <span className="font-medium">{timeRange}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading usage details...</div>
          )}
        </div>

        {/* Error Analysis */}
        {usageStats?.error_reasons && usageStats.error_reasons.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Analysis</h3>
            <div className="space-y-3">
              {usageStats.error_reasons.map((error, index) => (
                <div key={index} className="border border-red-200 rounded-md p-4 bg-red-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FiAlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-900">{error.reason}</span>
                      <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded-full">
                        {error.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-900">{error.count} times</div>
                      <div className="text-xs text-red-600">HTTP {error.http_status}</div>
                    </div>
                  </div>
                  <p className="text-sm text-red-700">{error.how_to_fix}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderProxiesTab() {
    return (
      <div className="space-y-4">
        {/* Proxy List Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Proxy List</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} ({totalProxies.toLocaleString()} total)
              </span>
              <button
                onClick={downloadProxies}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-md transition-colors flex items-center text-sm"
              >
                <FiDownload className="mr-2" size={16} />
                Export All
              </button>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mb-4">
              <button
                onClick={() => loadProxies(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                {currentPage}
              </span>
              <button
                onClick={() => loadProxies(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200 transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Proxy Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credentials
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ASN Info
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proxies.map((proxy) => (
                  <tr key={proxy.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {proxy.valid ? (
                          <FiCheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <FiXCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          proxy.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {proxy.valid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="mr-2">{getCountryFlag(proxy.country_code)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{proxy.country_code}</div>
                          <div className="text-xs text-gray-500">{proxy.city_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">
                        {proxy.proxy_address}:{proxy.port}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-600">
                        <div>{proxy.username}</div>
                        <div className="text-xs">****{proxy.password.slice(-4)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {proxy.asn_number && proxy.asn_name ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">ASN{proxy.asn_number}</div>
                          <div className="text-xs text-gray-500">{proxy.asn_name}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(proxy.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {proxies.length === 0 && !loading && (
            <div className="text-center py-8">
              <FiServer className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No proxies found</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderAnalyticsTab() {
    const usageStats = dashboardData?.usageStats;
    
    return (
      <div className="space-y-4">
        {/* Usage Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Total Bandwidth</h3>
              <FiActivity className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {usageStats ? formatBytes(usageStats.bandwidth_total) : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Avg: {usageStats ? formatBytes(usageStats.bandwidth_average) : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Total Requests</h3>
              <FiBarChart className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {usageStats ? usageStats.requests_total.toLocaleString() : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Success: {usageStats ? usageStats.requests_successful.toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Success Rate</h3>
              <FiCheckCircle className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {usageStats && usageStats.requests_total > 0 
                ? ((usageStats.requests_successful / usageStats.requests_total) * 100).toFixed(1) + '%'
                : 'N/A'
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Failed: {usageStats ? usageStats.requests_failed.toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Avg RPS</h3>
              <FiClock className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {usageStats ? usageStats.average_rps.toFixed(1) : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Concurrency: {usageStats ? usageStats.average_concurrency.toFixed(1) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Protocol & Country Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Protocol Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Protocol Usage</h3>
            {usageStats?.protocols_used ? (
              <div className="space-y-3">
                {Object.entries(usageStats.protocols_used).map(([protocol, count]) => (
                  <div key={protocol} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium uppercase">{protocol}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="bg-gray-200 rounded-full h-2 w-20">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(count / Math.max(...Object.values(usageStats.protocols_used))) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">{count.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No protocol data available</div>
            )}
          </div>

          {/* Country Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Country Usage</h3>
            {usageStats?.countries_used ? (
              <div className="space-y-3">
                {Object.entries(usageStats.countries_used)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{getCountryFlag(country)}</span>
                        <span className="text-sm font-medium">{country}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="bg-gray-200 rounded-full h-2 w-20">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ 
                              width: `${(count / Math.max(...Object.values(usageStats.countries_used))) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">{count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No country usage data available</div>
            )}
          </div>
        </div>

        {/* Usage Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Details ({timeRange})</h3>
          {usageStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Proxy Utilization</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Proxies Used:</span>
                    <span className="font-medium">{usageStats.number_of_proxies_used.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Concurrency:</span>
                    <span className="font-medium">{usageStats.average_concurrency.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Request:</span>
                    <span className="font-medium">{formatDate(usageStats.last_request_sent_at)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg RPS:</span>
                    <span className="font-medium">{usageStats.average_rps.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Bandwidth:</span>
                    <span className="font-medium">{formatBytes(usageStats.bandwidth_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Bandwidth:</span>
                    <span className="font-medium">{formatBytes(usageStats.bandwidth_average)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Data Quality</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Is Projected:</span>
                    <span className={`font-medium ${usageStats.is_projected ? 'text-yellow-600' : 'text-green-600'}`}>
                      {usageStats.is_projected ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Timestamp:</span>
                    <span className="font-medium">{formatDate(usageStats.timestamp)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time Range:</span>
                    <span className="font-medium">{timeRange}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading usage details...</div>
          )}
        </div>

        {/* Error Analysis */}
        {usageStats?.error_reasons && usageStats.error_reasons.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Analysis</h3>
            <div className="space-y-3">
              {usageStats.error_reasons.map((error, index) => (
                <div key={index} className="border border-red-200 rounded-md p-4 bg-red-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FiAlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-900">{error.reason}</span>
                      <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded-full">
                        {error.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-900">{error.count} times</div>
                      <div className="text-xs text-red-600">HTTP {error.http_status}</div>
                    </div>
                  </div>
                  <p className="text-sm text-red-700">{error.how_to_fix}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderProxiesTab() {
    return (
      <div className="space-y-4">
        {/* Proxy List Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Proxy List</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} ({totalProxies.toLocaleString()} total)
              </span>
              <button
                onClick={downloadProxies}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-md transition-colors flex items-center text-sm"
              >
                <FiDownload className="mr-2" size={16} />
                Export All
              </button>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mb-4">
              <button
                onClick={() => loadProxies(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                {currentPage}
              </span>
              <button
                onClick={() => loadProxies(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200 transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Proxy Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credentials
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ASN Info
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proxies.map((proxy) => (
                  <tr key={proxy.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {proxy.valid ? (
                          <FiCheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <FiXCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          proxy.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {proxy.valid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="mr-2">{getCountryFlag(proxy.country_code)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{proxy.country_code}</div>
                          <div className="text-xs text-gray-500">{proxy.city_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">
                        {proxy.proxy_address}:{proxy.port}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-600">
                        <div>{proxy.username}</div>
                        <div className="text-xs">****{proxy.password.slice(-4)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {proxy.asn_number && proxy.asn_name ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">ASN{proxy.asn_number}</div>
                          <div className="text-xs text-gray-500">{proxy.asn_name}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(proxy.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {proxies.length === 0 && !loading && (
            <div className="text-center py-8">
              <FiServer className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No proxies found</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderAnalyticsTab() {
    const usageStats = dashboardData?.usageStats;
    
    return (
      <div className="space-y-4">
        {/* Usage Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Total Bandwidth</h3>
              <FiActivity className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {usageStats ? formatBytes(usageStats.bandwidth_total) : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Avg: {usageStats ? formatBytes(usageStats.bandwidth_average) : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Total Requests</h3>
              <FiBarChart className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {usageStats ? usageStats.requests_total.toLocaleString() : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Success: {usageStats ? usageStats.requests_successful.toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Success Rate</h3>
              <FiCheckCircle className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {usageStats && usageStats.requests_total > 0 
                ? ((usageStats.requests_successful / usageStats.requests_total) * 100).toFixed(1) + '%'
                : 'N/A'
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Failed: {usageStats ? usageStats.requests_failed.toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Avg RPS</h3>
              <FiClock className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {usageStats ? usageStats.average_rps.toFixed(1) : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Concurrency: {usageStats ? usageStats.average_concurrency.toFixed(1) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Protocol & Country Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Protocol Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Protocol Usage</h3>
            {usageStats?.protocols_used ? (
              <div className="space-y-3">
                {Object.entries(usageStats.protocols_used).map(([protocol, count]) => (
                  <div key={protocol} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium uppercase">{protocol}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="bg-gray-200 rounded-full h-2 w-20">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(count / Math.max(...Object.values(usageStats.protocols_used))) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">{count.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No protocol data available</div>
            )}
          </div>

          {/* Country Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Country Usage</h3>
            {usageStats?.countries_used ? (
              <div className="space-y-3">
                {Object.entries(usageStats.countries_used)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{getCountryFlag(country)}</span>
                        <span className="text-sm font-medium">{country}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="bg-gray-200 rounded-full h-2 w-20">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ 
                              width: `${(count / Math.max(...Object.values(usageStats.countries_used))) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">{count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No country usage data available</div>
            )}
          </div>
        </div>

        {/* Usage Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Details ({timeRange})</h3>
          {usageStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Proxy Utilization</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Proxies Used:</span>
                    <span className="font-medium">{usageStats.number_of_proxies_used.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Concurrency:</span>
                    <span className="font-medium">{usageStats.average_concurrency.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Request:</span>
                    <span className="font-medium">{formatDate(usageStats.last_request_sent_at)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg RPS:</span>
                    <span className="font-medium">{usageStats.average_rps.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Bandwidth:</span>
                    <span className="font-medium">{formatBytes(usageStats.bandwidth_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Bandwidth:</span>
                    <span className="font-medium">{formatBytes(usageStats.bandwidth_average)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Data Quality</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Is Projected:</span>
                    <span className={`font-medium ${usageStats.is_projected ? 'text-yellow-600' : 'text-green-600'}`}>
                      {usageStats.is_projected ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Timestamp:</span>
                    <span className="font-medium">{formatDate(usageStats.timestamp)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time Range:</span>
                    <span className="font-medium">{timeRange}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading usage details...</div>
          )}
        </div>

        {/* Error Analysis */}
        {usageStats?.error_reasons && usageStats.error_reasons.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Analysis</h3>
            <div className="space-y-3">
              {usageStats.error_reasons.map((error, index) => (
                <div key={index} className="border border-red-200 rounded-md p-4 bg-red-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FiAlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-900">{error.reason}</span>
                      <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded-full">
                        {error.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-900">{error.count} times</div>
                      <div className="text-xs text-red-600">HTTP {error.http_status}</div>
                    </div>
                  </div>
                  <p className="text-sm text-red-700">{error.how_to_fix}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderPerformanceTab() {
    return (
      <div className="space-y-4">
        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Response Time</h3>
              <FiClock className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {dashboardData?.usageStats?.average_rps 
                ? `${(1000 / dashboardData.usageStats.average_rps).toFixed(0)}ms`
                : 'N/A'
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">Average</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Throughput</h3>
              <FiActivity className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {dashboardData?.usageStats?.average_rps 
                ? `${dashboardData.usageStats.average_rps.toFixed(1)}/s`
                : 'N/A'
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">Requests per second</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Concurrency</h3>
              <FiServer className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {dashboardData?.usageStats?.average_concurrency 
                ? dashboardData.usageStats.average_concurrency.toFixed(1)
                : 'N/A'
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">Concurrent requests</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Reliability</h3>
              <FiCheckCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.success_rate ? `${stats.success_rate.toFixed(1)}%` : 'N/A'}
            </div>
            <div className="text-sm text-gray-600 mt-1">Success rate</div>
          </div>
        </div>

        {/* Performance Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bandwidth Performance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bandwidth Performance</h3>
            {dashboardData?.usageStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Bandwidth Used:</span>
                  <span className="font-medium">{formatBytes(dashboardData.usageStats.bandwidth_total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Average per Request:</span>
                  <span className="font-medium">{formatBytes(dashboardData.usageStats.bandwidth_average)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Efficiency Score:</span>
                  <span className="font-medium">
                    {dashboardData.usageStats.requests_total > 0 
                      ? `${((dashboardData.usageStats.bandwidth_total / dashboardData.usageStats.requests_total / 1024)).toFixed(1)} KB/req`
                      : 'N/A'
                    }
                  </span>
                </div>
                
                {/* Subscription Usage */}
                {dashboardData.subscription && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Subscription Usage:</span>
                      <span className="font-medium">
                        {((dashboardData.subscription.usage_bandwidth / (dashboardData.subscription.bandwidth_gb * 1024 * 1024 * 1024)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, (dashboardData.subscription.usage_bandwidth / (dashboardData.subscription.bandwidth_gb * 1024 * 1024 * 1024)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{formatBytes(dashboardData.subscription.usage_bandwidth)} used</span>
                      <span>{dashboardData.subscription.bandwidth_gb}GB limit</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Loading bandwidth data...</div>
            )}
          </div>

          {/* Request Performance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Performance</h3>
            {dashboardData?.usageStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Requests:</span>
                  <span className="font-medium">{dashboardData.usageStats.requests_total.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Successful:</span>
                  <span className="font-medium text-green-600">{dashboardData.usageStats.requests_successful.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Failed:</span>
                  <span className="font-medium text-red-600">{dashboardData.usageStats.requests_failed.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Success Rate:</span>
                  <span className="font-medium">
                    {dashboardData.usageStats.requests_total > 0 
                      ? `${((dashboardData.usageStats.requests_successful / dashboardData.usageStats.requests_total) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </span>
                </div>

                {/* Request Distribution */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Successful</span>
                    <span>Failed</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-l-full" 
                      style={{ 
                        width: `${dashboardData.usageStats.requests_total > 0 ? (dashboardData.usageStats.requests_successful / dashboardData.usageStats.requests_total) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Subscription Usage */}
                {dashboardData.subscription && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Request Quota Usage:</span>
                      <span className="font-medium">
                        {dashboardData.subscription.usage_requests.toLocaleString()} requests
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Loading request data...</div>
            )}
          </div>
        </div>

        {/* Proxy Pool Performance */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Proxy Pool Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Pool Health</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Proxies:</span>
                    <span className="font-medium">{stats.total_proxies.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Valid Proxies:</span>
                    <span className="font-medium text-green-600">{stats.valid_proxies.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Invalid Proxies:</span>
                    <span className="font-medium text-red-600">{stats.invalid_proxies.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Success Rate:</span>
                    <span className="font-medium">{stats.success_rate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Geographic Diversity</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Countries:</span>
                    <span className="font-medium">{stats.countries.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cities:</span>
                    <span className="font-medium">{stats.cities.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg per Country:</span>
                    <span className="font-medium">{(stats.total_proxies / stats.countries.length).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Diversity Score:</span>
                    <span className="font-medium">
                      {Math.min(100, (stats.countries.length / 20) *  100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Pool Freshness</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Average Age:</span>
                    <span className="font-medium">{stats.avg_creation_age_days} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Newest Proxy:</span>
                    <span className="font-medium">{formatDate(stats.newest_proxy_date)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Oldest Proxy:</span>
                    <span className="font-medium">{formatDate(stats.oldest_proxy_date)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Freshness Score:</span>
                    <span className="font-medium">
                      {Math.max(0, 100 - (stats.avg_creation_age_days / 30) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Recommendations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Recommendations</h3>
          <div className="space-y-3">
            {stats && stats.success_rate < 90 && (
              <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-md">
                <FiAlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">Low Success Rate</h4>
                  <p className="text-sm text-yellow-700">
                    Your proxy pool has a {stats.success_rate.toFixed(1)}% success rate. Consider refreshing invalid proxies or upgrading your plan.
                  </p>
                </div>
              </div>
            )}
            
            {dashboardData?.usageStats && dashboardData.usageStats.average_rps < 1 && (
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-md">
                <FiActivity className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Low Request Rate</h4>
                  <p className="text-sm text-blue-700">
                    Your average request rate is {dashboardData.usageStats.average_rps.toFixed(1)} RPS. Consider optimizing your request patterns for better throughput.
                  </p>
                </div>
              </div>
            )}

            {stats && stats.countries.length < 5 && (
              <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-md">
                <FiMapPin className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-900">Limited Geographic Diversity</h4>
                  <p className="text-sm text-purple-700">
                    Your proxies are limited to {stats.countries.length} countries. Consider expanding to more locations for better coverage.
                  </p>
                </div>
              </div>
            )}

            {dashboardData?.subscription && (dashboardData.subscription.usage_bandwidth / (dashboardData.subscription.bandwidth_gb * 1024 * 1024 * 1024)) > 0.8 && (
              <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-md">
                <FiAlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900">High Bandwidth Usage</h4>
                  <p className="text-sm text-red-700">
                    You've used {((dashboardData.subscription.usage_bandwidth / (dashboardData.subscription.bandwidth_gb * 1024 * 1024 * 1024)) * 100).toFixed(1)}% of your bandwidth quota. Consider monitoring usage more closely.
                  </p>
                </div>
              </div>
            )}

            {(!dashboardData?.usageStats?.error_reasons || dashboardData.usageStats.error_reasons.length === 0) && stats && stats.success_rate > 95 && (
              <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-md">
                <FiCheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">Excellent Performance</h4>
                  <p className="text-sm text-green-700">
                    Your proxy setup is performing excellently with a {stats.success_rate.toFixed(1)}% success rate and no recent errors!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default WebshareProxyManagerFixed;
