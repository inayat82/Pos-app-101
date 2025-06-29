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
  id: number;
  free_credits?: number;
  plan?: number;
  term?: string;
  start_date?: string;
  end_date?: string;
  payment_method?: number;
  renewals_paid?: number;
  failed_payment_times?: number;
  account_discount_percentage?: number;
  customizable?: boolean;
  promo_type?: string | null;
  promo_value?: string | null;
  throttled?: boolean;
  paused?: boolean;
  reactivation_date?: string | null;
  reactivation_period_left?: string | null;
  created_at?: string;
  updated_at?: string;
  // Legacy fields for backward compatibility
  name?: string;
  plan_name?: string;
  proxy_count?: number;
  bandwidth_gb?: number;
  expires_at?: string;
  expiry_date?: string;
  valid_until?: string;
  is_active?: boolean;
  active?: boolean;
  status?: string;
  usage_bandwidth?: number;
  usage_requests?: number;
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

const WebshareProxyManagerClean: React.FC = () => {
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
    const loadSavedApiKey = async () => {
      try {
        // First try localStorage for immediate access
        const localToken = localStorage.getItem('webshare_api_token');
        
        // Then try to get from database
        const response = await fetch('/api/superadmin/webshare/settings');
        const result = await response.json();
        
        if (result.success && result.data.hasApiKey && result.data.apiKey) {
          const dbToken = result.data.apiKey;
          
          // Use database token if available, otherwise use local
          const tokenToUse = dbToken || localToken;
          
          if (tokenToUse) {
            setApiToken(tokenToUse);
            
            // Update localStorage if we got a newer token from database
            if (dbToken && dbToken !== localToken) {
              localStorage.setItem('webshare_api_token', dbToken);
            }
            
            // Auto-test connection if we have a token
            console.log(`Auto-testing connection with ${dbToken ? 'database' : 'localStorage'} token...`);
            
            setTimeout(async () => {
              try {
                // Test connection first
                const testResponse = await fetch('/api/superadmin/webshare', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    apiToken: tokenToUse,
                    action: 'test-connection'
                  }),
                });

                const testResult = await testResponse.json();

                if (testResult.success) {
                  setIsConnected(true);
                  setSuccess('Connection restored successfully!');
                  
                  // Load data after successful connection
                  await loadProxies();
                  await loadDashboardData();
                } else {
                  console.log('Auto-connection test failed:', testResult.error);
                  setError('Saved API key is no longer valid. Please test connection again.');
                  setIsConnected(false);
                }
              } catch (error) {
                console.log('Auto-load failed:', error);
                setError('Failed to connect with saved API key. Please test connection again.');
                setIsConnected(false);
              }
            }, 500);
          }
        } else if (localToken) {
          // Fallback to localStorage only
          setApiToken(localToken);
          console.log('Using localStorage token, testing connection...');
          
          setTimeout(async () => {
            try {
              const testResponse = await fetch('/api/superadmin/webshare', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  apiToken: localToken,
                  action: 'test-connection'
                }),
              });

              const testResult = await testResponse.json();

              if (testResult.success) {
                setIsConnected(true);
                setSuccess('Connection restored from local storage!');
                await loadProxies();
                await loadDashboardData();
              } else {
                setIsConnected(false);
                setError('Saved API key is no longer valid. Please test connection again.');
              }
            } catch (error) {
              console.log('Auto-load failed:', error);
              setIsConnected(false);
            }
          }, 500);
        }
      } catch (error) {
        console.error('Error loading saved API key:', error);
        // Fallback to localStorage
        const localToken = localStorage.getItem('webshare_api_token');
        if (localToken) {
          setApiToken(localToken);
        }
      }
    };

    loadSavedApiKey();
  }, []);

  // Reload dashboard data when time range changes
  useEffect(() => {
    if (isConnected && apiToken.trim()) {
      loadDashboardData();
    }
  }, [timeRange]);

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
        
        // Save to database with successful test status
        try {
          await fetch('/api/superadmin/webshare/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              apiKey: apiToken.trim(),
              testStatus: 'connected',
              lastTestError: null
            }),
          });
        } catch (saveError) {
          console.error('Failed to save API key to database:', saveError);
          // Don't show error to user as connection test succeeded
        }
        
        // Automatically load proxy data after successful connection
        setTimeout(async () => {
          await loadProxies();
          await loadDashboardData();
        }, 1000);
      } else {
        setError(result.error || 'Failed to connect to Webshare API');
        setIsConnected(false);
        
        // Save to database with failed test status
        try {
          await fetch('/api/superadmin/webshare/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              apiKey: apiToken.trim(),
              testStatus: 'failed',
              lastTestError: result.error || 'Connection test failed'
            }),
          });
        } catch (saveError) {
          console.error('Failed to save API key to database:', saveError);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      setError(errorMessage);
      setIsConnected(false);
      
      // Save to database with failed test status
      try {
        await fetch('/api/superadmin/webshare/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: apiToken.trim(),
            testStatus: 'failed',
            lastTestError: errorMessage
          }),
        });
      } catch (saveError) {
        console.error('Failed to save API key to database:', saveError);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveApiToken = async () => {
    if (!apiToken.trim()) {
      setError('Please enter an API token to save');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/superadmin/webshare/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiToken.trim(),
          testStatus: 'testing', // Will be updated when connection is tested
          lastTestError: null
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('API token saved successfully! Please test the connection.');
        localStorage.setItem('webshare_api_token', apiToken.trim());
      } else {
        setError(result.error || 'Failed to save API token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API token');
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

  // Utility functions
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const safeToLocaleString = (num: number | undefined | null) => {
    if (typeof num !== 'number') {
      return 'N/A';
    }
    return num.toLocaleString();
  };

  // Render functions
  const renderOverviewTab = () => {
    if (!dashboardData) {
      return <div className="text-center py-8 text-gray-500">Loading dashboard data...</div>;
    }

    const { profile, subscription, usageStats, ipAuth, errors } = dashboardData;

    return (
      <div className="space-y-4">
        {errors && errors.length > 0 && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">API Errors:</p>
                <ul className="list-disc list-inside">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
              <button
                onClick={loadDashboardData}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-md transition-colors text-sm"
              >
                Retry
              </button>
            </div>
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
                <p><strong>Plan:</strong> {subscription.term || subscription.name || subscription.plan_name || 'N/A'}</p>
                <p><strong>Expires:</strong> {
                  (() => {
                    const expiryDate = subscription.end_date || subscription.expires_at || subscription.expiry_date || subscription.valid_until;
                    return expiryDate ? formatDate(expiryDate) : 'N/A';
                  })()
                }</p>
                <p><strong>Status:</strong> {
                  (() => {
                    // Check if subscription is active based on end_date
                    const endDate = subscription.end_date || subscription.expires_at || subscription.expiry_date || subscription.valid_until;
                    const isActive = endDate ? new Date(endDate) > new Date() : false;
                    const isActiveFromFlags = subscription.is_active === true || subscription.active === true || subscription.status === 'active';
                    const isPaused = subscription.paused === true;
                    const isThrottled = subscription.throttled === true;
                    
                    if (isPaused) {
                      return <span className="text-yellow-600">Paused</span>;
                    } else if (isThrottled) {
                      return <span className="text-orange-600">Throttled</span>;
                    } else if (isActive || isActiveFromFlags) {
                      return <span className="text-green-600">Active</span>;
                    } else {
                      return <span className="text-red-600">Inactive</span>;
                    }
                  })()
                }</p>
                {subscription.proxy_count && (
                  <p><strong>Proxies:</strong> {safeToLocaleString(subscription.proxy_count)}</p>
                )}
                {subscription.bandwidth_gb && (
                  <p><strong>Bandwidth:</strong> {subscription.bandwidth_gb} GB/month</p>
                )}
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

  const renderProxiesTab = () => {
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
  };

  const renderAnalyticsTab = () => {
    const usageStats = dashboardData?.usageStats;
    
    if (!dashboardData) {
      return <div className="text-center py-8 text-gray-500">Loading analytics data...</div>;
    }
    
    if (!usageStats) {
      return (
        <div className="space-y-4">
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md">
            <p className="font-bold">No Usage Data Available</p>
            <p>This could be because:</p>
            <ul className="list-disc list-inside mt-2">
              <li>No proxy usage in the selected time period ({timeRange})</li>
              <li>API returned empty usage statistics</li>
              <li>Try selecting a different time range</li>
            </ul>
          </div>
        </div>
      );
    }
    
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
              {usageStats ? safeToLocaleString(usageStats.requests_total) : 'Loading...'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Success: {usageStats ? safeToLocaleString(usageStats.requests_successful) : 'N/A'}
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
              Failed: {usageStats ? safeToLocaleString(usageStats.requests_failed) : 'N/A'}
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
                    <span className="font-medium">{safeToLocaleString(usageStats.number_of_proxies_used)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Concurrency:</span>
                    <span className="font-medium">{usageStats.average_concurrency.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Request:</span>
                    <span className="font-medium">{usageStats.last_request_sent_at ? formatDate(usageStats.last_request_sent_at) : 'N/A'}</span>
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
      </div>
    );
  };

  const renderPerformanceTab = () => {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        <p className="text-gray-600">Performance monitoring features coming soon...</p>
      </div>
    );
  };

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
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
          <div className="md:col-span-2">
            <div className="relative">
              <input
                type={isTokenVisible ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Enter your Webshare API token (get from dashboard.webshare.io/userapi/keys)"
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
            onClick={saveApiToken}
            disabled={loading || !apiToken.trim()}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center text-sm"
          >
            <FiDownload className="mr-2" size={16} />
            Save Token
          </button>
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
            href="https://dashboard.webshare.io/userapi/keys"
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
};

export default WebshareProxyManagerClean;
