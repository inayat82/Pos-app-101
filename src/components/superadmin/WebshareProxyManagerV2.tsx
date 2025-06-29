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
      setError('Failed to export proxies');
    }
  };

  const getFilteredProxies = () => {
    let proxies = proxyService.getProxies(selectedPool, filters);
    
    if (searchTerm) {
      proxies = proxies.filter(p => 
        p.proxy_address.includes(searchTerm) ||
        p.country_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.city_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    return {
      proxies: proxies.slice(startIndex, endIndex),
      total: proxies.length
    };
  };

  const { proxies: displayProxies, total: filteredTotal } = getFilteredProxies();

  // API Token Setup UI
  if (!isTokenSet) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Webshare API Setup</CardTitle>
          <CardDescription>
            Enter your Webshare API token to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Enter Webshare API Token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
          />
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button 
            onClick={handleSetApiToken} 
            disabled={loading}
            className="w-full"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Connect to Webshare
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Proxies</p>
                <p className="text-2xl font-bold">
                  {globalStats?.totalProxies?.toLocaleString() || 0}
                </p>
              </div>
              <Globe className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Loaded Proxies</p>
                <p className="text-2xl font-bold">
                  {globalStats?.loadedProxies?.toLocaleString() || 0}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {globalStats?.successRate?.toFixed(1) || 0}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Pools</p>
                <p className="text-2xl font-bold">{pools.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="proxies" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="proxies">Proxy Management</TabsTrigger>
          <TabsTrigger value="pools">Pool Management</TabsTrigger>
          <TabsTrigger value="health">Health Monitor</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="proxies" className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              <Select value={selectedPool} onValueChange={setSelectedPool}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select Pool" />
                </SelectTrigger>
                <SelectContent>
                  {pools.map(pool => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name} ({pool.loadedCount}/{pool.totalCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                placeholder="Search proxies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={loading}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button 
                onClick={handleLoadMore} 
                disabled={loading}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Load More
              </Button>
              
              <Select onValueChange={(value) => handleExport(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Export" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                  <SelectItem value="proxy-list">Proxy List</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <Select onValueChange={(value) => setFilters(prev => ({ ...prev, country: value || undefined }))}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Countries</SelectItem>
                {globalStats?.topCountries?.map((country: any) => (
                  <SelectItem key={country.country} value={country.country}>
                    {country.country} ({country.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select onValueChange={(value) => setFilters(prev => ({ ...prev, isValid: value === 'true' ? true : value === 'false' ? false : undefined }))}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="true">Valid Only</SelectItem>
                <SelectItem value="false">Invalid Only</SelectItem>
              </SelectContent>
            </Select>
            
            <Select onValueChange={(value) => setPageSize(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Page Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
                <SelectItem value="200">200 per page</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={() => {
                setFilters({});
                setSearchTerm('');
                setCurrentPage(1);
              }}
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>

          {/* Proxy List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  Proxies ({filteredTotal.toLocaleString()})
                </CardTitle>
                {loading && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {displayProxies.map((proxy) => (
                  <div 
                    key={proxy.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => onProxySelect?.(proxy)}
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">
                          {proxy.proxy_address}:{proxy.port}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {proxy.city_name}, {proxy.country_code}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge variant={proxy.is_valid ? "default" : "destructive"}>
                        {proxy.is_valid ? "Valid" : "Invalid"}
                      </Badge>
                      <Badge variant="outline">
                        Used {proxy.usage_count} times
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pools" className="space-y-4">
          {/* Pool Creation */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Pool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Pool name"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                />
                <Select onValueChange={(value) => setNewPoolConfig(prev => ({ ...prev, country: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZA">South Africa</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="DE">Germany</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreatePool} disabled={loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Pool
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Pools */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((pool) => (
              <Card key={pool.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{pool.name}</CardTitle>
                  <CardDescription>Pool ID: {pool.id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Loaded:</span>
                      <span>{pool.loadedCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span>{pool.totalCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <Badge variant={pool.isComplete ? "default" : "secondary"}>
                        {pool.isComplete ? "Complete" : "Partial"}
                      </Badge>
                    </div>
                    <Progress 
                      value={pool.totalCount > 0 ? (pool.loadedCount / pool.totalCount) * 100 : 0} 
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(pool.lastUpdate).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Proxy Health Monitor</CardTitle>
                <Button 
                  onClick={handleHealthCheck}
                  disabled={healthCheckRunning}
                >
                  {healthCheckRunning ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  Run Health Check
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {healthResults && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {healthResults.healthy}
                      </p>
                      <p className="text-sm text-muted-foreground">Healthy</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {healthResults.tested - healthResults.healthy}
                      </p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {healthResults.tested}
                      </p>
                      <p className="text-sm text-muted-foreground">Tested</p>
                    </div>
                  </div>
                  
                  <Progress 
                    value={(healthResults.healthy / healthResults.tested) * 100} 
                    className="w-full"
                  />
                  
                  <div className="text-center text-sm text-muted-foreground">
                    Health Rate: {((healthResults.healthy / healthResults.tested) * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Pool Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {globalStats?.poolStats?.map((pool: any) => (
                    <div key={pool.poolId} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{pool.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {pool.loaded.toLocaleString()} / {pool.count.toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={pool.complete ? "default" : "secondary"}>
                        {pool.complete ? "Complete" : "Loading"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Top Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {globalStats?.topCountries?.map((country: any, index: number) => (
                    <div key={country.country} className="flex justify-between items-center">
                      <span className="flex items-center">
                        <span className="w-6 text-sm text-muted-foreground">
                          {index + 1}.
                        </span>
                        {country.country}
                      </span>
                      <Badge variant="outline">
                        {country.count.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
