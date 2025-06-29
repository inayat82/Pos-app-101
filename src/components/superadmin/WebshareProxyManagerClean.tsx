'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiGlobe, 
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiFilter,
  FiSearch,
  FiPlus,
  FiTrash2,
  FiPlay,
  FiPause,
  FiBarChart,
  FiRefreshCw,
  FiDownload,
  FiUpload,
  FiSettings
} from 'react-icons/fi';

import WebshareProxyServiceV2 from '@/lib/services/webshareProxyServiceV2';
import { WEBSHARE_CONFIG, validateWebshareConfig } from '@/lib/config/webshareConfig';
import { 
  ProxyPool, 
  WebshareProxy, 
  ProxyFilterOptions, 
  ProxyLoadOptions 
} from '@/types/webshare';

interface WebshareProxyManagerV2Props {
  onProxySelect?: (proxy: WebshareProxy) => void;
}

export default function WebshareProxyManagerV2({ onProxySelect }: WebshareProxyManagerV2Props) {
  const [proxyService] = useState(() => new WebshareProxyServiceV2());
  const [pools, setPools] = useState<ProxyPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [apiToken, setApiToken] = useState('');
  const [isTokenSet, setIsTokenSet] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<ProxyFilterOptions>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProxies, setSelectedProxies] = useState<number[]>([]);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  
  // Pool creation states
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolConfig, setNewPoolConfig] = useState<ProxyLoadOptions>({});
  
  // Health check states
  const [healthCheckRunning, setHealthCheckRunning] = useState(false);
  const [healthResults, setHealthResults] = useState<any>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('proxies');

  // Initialize service and validate config
  useEffect(() => {
    const validation = validateWebshareConfig();
    if (!validation.isValid) {
      setError(`Configuration errors: ${validation.errors.join(', ')}`);
    }
    
    if (WEBSHARE_CONFIG.API_TOKEN) {
      proxyService.setApiToken(WEBSHARE_CONFIG.API_TOKEN);
      setApiToken(WEBSHARE_CONFIG.API_TOKEN);
      setIsTokenSet(true);
      loadInitialData();
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load default pool
      await proxyService.loadProxies('default', { pageSize: 100 });
      
      // Update state
      updatePoolsAndStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }, [proxyService]);

  const updatePoolsAndStats = useCallback(() => {
    const poolsData = proxyService.getProxyPools();
    const statsData = proxyService.getGlobalStats();
    
    setPools(poolsData);
    setGlobalStats(statsData);
    
    // Update pagination
    const currentPool = poolsData.find(p => p.id === selectedPool);
    if (currentPool) {
      setTotalPages(Math.ceil(currentPool.loadedCount / pageSize));
    }
  }, [proxyService, selectedPool, pageSize]);

  const handleSetApiToken = async () => {
    if (!apiToken.trim()) {
      setError('API token is required');
      return;
    }
    
    try {
      proxyService.setApiToken(apiToken);
      setIsTokenSet(true);
      setError(null);
      await loadInitialData();
    } catch (err) {
      setError('Failed to set API token. Please check your token and try again.');
    }
  };

  const handleLoadMore = async () => {
    try {
      setLoading(true);
      await proxyService.loadProxies(selectedPool, { 
        pageSize: 100,
        forceRefresh: false 
      });
      updatePoolsAndStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more proxies');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await proxyService.loadProxies(selectedPool, { 
        pageSize: 100,
        forceRefresh: true 
      });
      updatePoolsAndStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh proxies');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = async () => {
    if (!newPoolName.trim()) {
      setError('Pool name is required');
      return;
    }
    
    try {
      setLoading(true);
      await proxyService.createProxyPool(newPoolName, newPoolName, newPoolConfig);
      setNewPoolName('');
      setNewPoolConfig({});
      updatePoolsAndStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pool');
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    try {
      setHealthCheckRunning(true);
      const results = await proxyService.healthCheck(selectedPool, 20);
      setHealthResults(results);
      updatePoolsAndStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setHealthCheckRunning(false);
    }
  };

  const handleExport = (format: 'json' | 'txt' | 'csv' | 'proxy-list') => {
    try {
      const data = proxyService.exportProxies(selectedPool, format, filters);
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxies_${selectedPool}_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const currentPool = pools.find(p => p.id === selectedPool);
  const poolProxies = currentPool?.proxies || [];
  
  // Apply search and filters
  const filteredProxies = poolProxies.filter(proxy => {
    if (searchTerm && !proxy.proxy_address.includes(searchTerm) && !proxy.port.toString().includes(searchTerm)) {
      return false;
    }
    if (filters.country && proxy.country_code !== filters.country) {
      return false;
    }
    if (filters.isValid !== undefined && proxy.is_valid !== filters.isValid) {
      return false;
    }
    return true;
  });

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProxies = filteredProxies.slice(startIndex, startIndex + pageSize);

  // API Token Setup Screen
  if (!isTokenSet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <FiGlobe className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Webshare API Setup</h2>
            <p className="text-gray-600 mt-2">
              Enter your Webshare API token to manage your proxy pool
            </p>
          </div>
          
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Enter your Webshare API token"
              value={apiToken}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center space-x-2">
                <FiAlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}
            
            <button
              onClick={handleSetApiToken}
              disabled={loading || !apiToken.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center"
            >
              {loading && <FiRefreshCw className="h-4 w-4 animate-spin mr-2" />}
              Set API Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Proxies</p>
              <p className="text-2xl font-bold text-gray-900">
                {globalStats?.totalProxies || 0}
              </p>
            </div>
            <FiGlobe className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Pools</p>
              <p className="text-2xl font-bold text-gray-900">
                {pools.length}
              </p>
            </div>
            <FiActivity className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Healthy Proxies</p>
              <p className="text-2xl font-bold text-gray-900">
                {globalStats?.healthyProxies || 0}
              </p>
            </div>
            <FiCheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Countries</p>
              <p className="text-2xl font-bold text-gray-900">
                {globalStats?.countries || 0}
              </p>
            </div>
            <FiBarChart className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center space-x-2">
          <FiAlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'proxies', label: 'Proxy Management', icon: FiGlobe },
              { id: 'pools', label: 'Pool Management', icon: FiSettings },
              { id: 'health', label: 'Health Check', icon: FiActivity },
              { id: 'export', label: 'Export & Import', icon: FiDownload }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Proxies Tab */}
          {activeTab === 'proxies' && (
            <div className="space-y-4">
              {/* Pool Selection and Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Pool:</label>
                  <select
                    value={selectedPool}
                    onChange={(e) => setSelectedPool(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                  >
                    {pools.map((pool) => (
                      <option key={pool.id} value={pool.id}>
                        {pool.name} ({pool.loadedCount} proxies)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm flex items-center space-x-1"
                  >
                    <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm flex items-center space-x-1"
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>Load More</span>
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by IP or port..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md flex items-center space-x-2"
                >
                  <FiFilter className="h-4 w-4" />
                  <span>Filters</span>
                </button>
              </div>

              {/* Proxy List */}
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Proxy Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Port
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Country
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        City
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedProxies.map((proxy) => (
                      <tr key={proxy.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {proxy.proxy_address}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {proxy.port}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {proxy.country_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {proxy.city_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            proxy.is_valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {proxy.is_valid ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => onProxySelect?.(proxy)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredProxies.length)} of{' '}
                  {filteredProxies.length} proxies
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 px-3 py-1 rounded-md text-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {Math.max(1, Math.ceil(filteredProxies.length / pageSize))}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(Math.ceil(filteredProxies.length / pageSize), currentPage + 1))}
                    disabled={currentPage >= Math.ceil(filteredProxies.length / pageSize)}
                    className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 px-3 py-1 rounded-md text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pool Management Tab */}
          {activeTab === 'pools' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-medium text-gray-900">Manage Proxy Pools</h3>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2">
                  <FiPlus className="h-4 w-4" />
                  <span>Create Pool</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pools.map((pool) => (
                  <div key={pool.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-medium text-gray-900">{pool.name}</h4>
                      <div className="flex items-center space-x-1">
                        <button className="text-gray-400 hover:text-gray-600">
                          <FiSettings className="h-4 w-4" />
                        </button>
                        <button className="text-red-400 hover:text-red-600">
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>Proxies: {pool.loadedCount}</p>
                      <p>Total Available: {pool.totalCount}</p>
                      <p>Last Updated: {pool.lastUpdate ? new Date(pool.lastUpdate).toLocaleDateString() : 'Never'}</p>
                      <p>Status: {pool.isComplete ? 'Complete' : 'Partial'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health Check Tab */}
          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-medium text-gray-900">Proxy Health Check</h3>
                <button
                  onClick={handleHealthCheck}
                  disabled={healthCheckRunning}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md flex items-center space-x-2"
                >
                  <FiPlay className={`h-4 w-4 ${healthCheckRunning ? 'animate-pulse' : ''}`} />
                  <span>{healthCheckRunning ? 'Running...' : 'Start Health Check'}</span>
                </button>
              </div>

              {healthResults && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-900 mb-2">Health Check Results</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Tested:</p>
                      <p className="font-medium">{healthResults.tested || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Healthy:</p>
                      <p className="font-medium text-green-600">{healthResults.healthy || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Failed:</p>
                      <p className="font-medium text-red-600">{healthResults.failed || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Success Rate:</p>
                      <p className="font-medium">{healthResults.successRate || '0%'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Export & Import</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Export Proxies</h4>
                  <div className="space-y-2">
                    {[
                      { format: 'json', label: 'JSON Format', description: 'Complete proxy data with metadata' },
                      { format: 'txt', label: 'Text Format', description: 'Simple IP:PORT list' },
                      { format: 'csv', label: 'CSV Format', description: 'Spreadsheet compatible' },
                      { format: 'proxy-list', label: 'Proxy List', description: 'Standard proxy format' }
                    ].map((option) => (
                      <button
                        key={option.format}
                        onClick={() => handleExport(option.format as any)}
                        className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{option.label}</p>
                            <p className="text-sm text-gray-600">{option.description}</p>
                          </div>
                          <FiDownload className="h-5 w-5 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Import Proxies</h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <FiUpload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Drag and drop proxy files here</p>
                    <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                    <button className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">
                      Choose File
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
